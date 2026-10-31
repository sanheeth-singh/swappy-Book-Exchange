from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import DomainError
from app.core.security import hash_password
from app.modules.books.models import BookListing
from app.modules.colleges.directory import directory_lock
from app.modules.colleges.models import Campus, College, Membership
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.policies import RESERVED_STATUSES
from app.modules.exchanges.queries import reject_pending
from app.modules.users.models import User
from app.modules.users.schemas import ProfileInput, RegisterInput


async def register(session: AsyncSession, data: RegisterInput) -> User:
    user = User(
        email=str(data.email), hashed_password=await run_in_threadpool(hash_password, data.password)
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise DomainError("email_unavailable", "This email is already registered.", 409)
    return user


async def update_profile(session: AsyncSession, actor: User, data: ProfileInput) -> User:
    await directory_lock(session)
    # Every membership mutation locks the user first, then membership, in the same order.
    user = await session.scalar(
        select(User)
        .where(User.id == actor.id)
        .with_for_update(key_share=True)
        .execution_options(populate_existing=True)
    )
    if not user.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    campus = await session.scalar(
        select(Campus).join(College).where(Campus.id == data.campus_id, College.is_active.is_(True))
    )
    if campus is None or not campus.is_active:
        raise DomainError("campus_unknown", "Choose an active campus from the directory.", 422)
    membership = await session.scalar(
        select(Membership).where(Membership.user_id == user.id).with_for_update()
    )
    if membership is None:
        membership = Membership(user_id=user.id, campus_id=data.campus_id)
        session.add(membership)
    elif user.campus_id != data.campus_id:
        unresolved = await session.scalar(
            select(Exchange.id)
            .where(
                or_(Exchange.requester_id == user.id, Exchange.owner_id == user.id),
                Exchange.status.in_(RESERVED_STATUSES),
            )
            .limit(1)
        )
        if unresolved:
            raise DomainError(
                "exchange_unresolved",
                "Resolve your accepted exchanges before changing campuses.",
                409,
            )
        own_ids = list(
            (
                await session.scalars(
                    select(BookListing.id)
                    .where(BookListing.owner_id == user.id)
                    .order_by(BookListing.id)
                    .with_for_update()
                )
            ).all()
        )
        await reject_pending(session, own_ids)
        await session.execute(
            update(BookListing).where(BookListing.owner_id == user.id).values(is_archived=True)
        )
        membership.campus_id = data.campus_id
        membership.status = "NOT_SUBMITTED"
        membership.active = True
        membership.expires_at = None
        membership.submission_id = None
        membership.document = None
        membership.document_type = None
        membership.document_expires_at = None
        membership.reviewed_by = None
        membership.reviewed_at = None
        membership.review_reason = None
    user.display_name = data.display_name
    user.campus_id = data.campus_id
    await session.commit()
    return user
