from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.books.genres import GENRE_LABELS, Genre
from app.modules.books.models import BookListing, BookPhoto, PhysicalBook
from app.modules.books.preview_schemas import PublicBookCard, PublicPreviewResponse
from app.modules.books.schemas import GenreResponse
from app.modules.books.service import (
    lock_actor,
    owned_listing,
    require_editable,
    require_unreserved,
)
from app.modules.colleges.models import Campus, College, Membership
from app.modules.users.models import User
from app.modules.users.queries import lock_users

PREVIEW_LIMIT = 100
PAGE_LIMIT = 20


def pool_query(now: datetime):
    publisher = (
        select(User.id)
        .join(Membership, Membership.user_id == User.id)
        .join(Campus, Campus.id == Membership.campus_id)
        .join(College, College.id == Campus.college_id)
        .where(
            User.id == BookListing.owner_id,
            User.is_active.is_(True),
            User.is_participation_restricted.is_(False),
            User.campus_id == BookListing.campus_id,
            Membership.campus_id == BookListing.campus_id,
            Membership.status == "VERIFIED",
            Membership.active.is_(True),
            or_(Membership.expires_at.is_(None), Membership.expires_at > now),
            Campus.is_active.is_(True),
            College.is_active.is_(True),
        )
        .correlate_except(User, Membership, Campus, College)
        .exists()
    )
    current_copy = (
        select(PhysicalBook.id)
        .where(
            PhysicalBook.id == BookListing.physical_book_id,
            PhysicalBook.owner_id == BookListing.owner_id,
        )
        .correlate_except(PhysicalBook)
        .exists()
    )
    cover = (
        select(BookPhoto.url)
        .where(BookPhoto.book_id == BookListing.id)
        .order_by(BookPhoto.created_at, BookPhoto.id)
        .limit(1)
        .correlate_except(BookPhoto)
        .scalar_subquery()
    )
    # No visitor-provided filters here: every visitor searches the same capped pool.
    return (
        select(
            BookListing.id,
            BookListing.title,
            BookListing.author,
            BookListing.genre,
            BookListing.condition,
            cover.label("cover_url"),
        )
        .where(
            BookListing.allow_public_preview.is_(True),
            BookListing.is_archived.is_(False),
            BookListing.is_hidden.is_(False),
            BookListing.is_reserved.is_(False),
            publisher,
            current_copy,
        )
        .order_by(BookListing.created_at.desc(), BookListing.id.desc())
        .limit(PREVIEW_LIMIT)
    )


async def browse(
    session: AsyncSession, limit: int, offset: int, q: str | None, genre: Genre | None
):
    # Fetch only up to 100 minimal cards in one query, then filter/page that bounded snapshot.
    rows = list((await session.execute(pool_query(datetime.now(UTC)))).mappings().all())[
        :PREVIEW_LIMIT
    ]
    needle = (q or "").strip().casefold()
    cards = [
        PublicBookCard.model_validate(row)
        for row in rows
        if (genre is None or row["genre"] == genre)
        and (not needle or needle in row["title"].casefold() or needle in row["author"].casefold())
    ]
    total = len(cards)
    items = cards[offset : offset + limit]
    next_offset = offset + len(items) if offset + len(items) < total else None
    return PublicPreviewResponse(
        items=items,
        total=total,
        next_offset=next_offset,
        genres=[GenreResponse(id=value, name=label) for value, label in GENRE_LABELS.items()],
    )


async def set_permission(session: AsyncSession, actor: User, book_id: UUID, allowed: bool):
    if allowed:
        user = await lock_actor(session, actor)
    else:
        # Withdrawal remains possible after membership/campus expiry, hiding or reservation.
        user = (await lock_users(session, [actor.id]))[actor.id]
        if not user.is_active:
            raise DomainError("account_inactive", "Account is inactive.")
    listing = await owned_listing(session, user, book_id)
    if allowed:
        require_editable(listing, user)
        await require_unreserved(session, listing)
    listing.allow_public_preview = allowed
    # Visibility consent alone does not invalidate proposals or alter handover snapshots.
    await session.commit()
    # SQL expression properties expire on flush; load before serialization.
    await session.refresh(listing, attribute_names=["is_reserved"])
    return listing
