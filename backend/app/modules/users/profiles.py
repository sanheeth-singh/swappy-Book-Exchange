from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.books.models import BookListing
from app.modules.books.queries import discoverable_listings
from app.modules.colleges.models import Campus, College, Membership
from app.modules.moderation.queries import blocked_pair
from app.modules.reviews.service import reputation, require_profile_access
from app.modules.users.avatars import avatar_url
from app.modules.users.models import User
from app.modules.users.profile_schemas import (
    CampusSummary,
    ProfileBooks,
    ProfileMetrics,
    PublicDetailsInput,
    PublicProfile,
)
from app.modules.users.queries import lock_users


def verified_membership(
    user: User,
    campus: Campus | None,
    membership: Membership | None,
    now: datetime,
    *,
    college_active: bool = True,
) -> bool:
    return bool(
        user.is_active
        and college_active
        and campus is not None
        and campus.is_active
        and membership is not None
        and membership.status == "VERIFIED"
        and membership.active
        and membership.campus_id == user.campus_id
        and (membership.expires_at is None or membership.expires_at > now)
    )


async def visible_user(session: AsyncSession, actor: User, target_id: UUID) -> User:
    await require_profile_access(session, actor, target_id)
    target = await session.get(User, target_id)
    if not target.is_active or (
        actor.id != target.id and await session.scalar(select(blocked_pair(actor.id, target.id)))
    ):
        raise DomainError("user_not_found", "Profile not found.", 404)
    return target


def profile_listings(actor: User, target_id: UUID):
    # Same visibility as campus browsing; another campus's books never leak via a profile.
    return discoverable_listings(actor.id).where(
        BookListing.owner_id == target_id, BookListing.campus_id == actor.campus_id
    )


async def profile(session: AsyncSession, actor: User, target_id: UUID) -> PublicProfile:
    target = await visible_user(session, actor, target_id)
    membership = await session.scalar(select(Membership).where(Membership.user_id == target_id))
    campus = await session.get(Campus, target.campus_id) if target.campus_id else None
    college = await session.get(College, campus.college_id) if campus else None
    metrics = await reputation(session, actor, target_id)
    count = await session.scalar(
        select(func.count()).select_from(profile_listings(actor, target_id).subquery())
    )
    return PublicProfile(
        id=target.id,
        display_name=target.display_name,
        avatar_id=target.avatar_id,
        avatar_url=avatar_url(target.avatar_id),
        bio=target.bio,
        reading_interests=target.reading_interests,
        campus=CampusSummary(
            id=campus.id,
            name=campus.name,
            city=campus.city,
            college_name=college.name,
            is_active=campus.is_active and college.is_active,
        )
        if campus
        else None,
        membership_verified=verified_membership(
            target,
            campus,
            membership,
            datetime.now(UTC),
            college_active=college is not None and college.is_active,
        ),
        is_self=actor.id == target.id,
        metrics=ProfileMetrics(active_listings=count, **metrics.model_dump(exclude={"user_id"})),
    )


async def books(
    session: AsyncSession, actor: User, target_id: UUID, limit: int, before: UUID | None
):
    await visible_user(session, actor, target_id)
    query = profile_listings(actor, target_id)
    if before is not None:
        cursor = await session.scalar(query.where(BookListing.id == before))
        if cursor is None:
            raise DomainError(
                "book_not_found", "Listing cursor not found. Reload the first page.", 404
            )
        query = query.where(
            tuple_(BookListing.created_at, BookListing.id) < (cursor.created_at, cursor.id)
        )
    rows = list(
        (
            await session.scalars(
                query.order_by(BookListing.created_at.desc(), BookListing.id.desc()).limit(
                    limit + 1
                )
            )
        ).all()
    )
    more = len(rows) > limit
    rows = rows[:limit]
    return ProfileBooks(items=rows, next_cursor=rows[-1].id if more else None)


async def edit_details(session: AsyncSession, actor: User, data: PublicDetailsInput):
    user = (await lock_users(session, [actor.id]))[actor.id]
    if not user.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await session.commit()
    return user
