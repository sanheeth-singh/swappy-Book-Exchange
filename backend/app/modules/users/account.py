from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import DomainError
from app.core.security import hash_password, verify_password
from app.modules.auth.models import LoginSession
from app.modules.books.models import BookListing
from app.modules.colleges.models import Membership
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.policies import ACTIVE_STATUSES
from app.modules.users.models import User
from app.modules.users.profile_schemas import DeactivationEligibility
from app.modules.users.queries import lock_users


async def deactivation_eligibility(session: AsyncSession, actor: User):
    counts = dict(
        (
            await session.execute(
                select(Exchange.status, func.count(Exchange.id))
                .where(
                    or_(Exchange.requester_id == actor.id, Exchange.owner_id == actor.id),
                    Exchange.status.in_(ACTIVE_STATUSES),
                )
                .group_by(Exchange.status)
            )
        ).all()
    )
    return DeactivationEligibility(
        can_deactivate=not counts,
        pending=counts.get("PENDING", 0),
        accepted=counts.get("ACCEPTED", 0),
        waiting_confirmation=counts.get("WAITING_CONFIRMATION", 0),
    )


async def reauthenticate(session: AsyncSession, actor: User, password: str) -> User:
    user = (await lock_users(session, [actor.id]))[actor.id]
    if not user.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    if not await run_in_threadpool(verify_password, password, user.hashed_password):
        raise DomainError("password_incorrect", "Current password is incorrect.")
    return user


async def revoke_all(session: AsyncSession, user_id, reason: str, now: datetime):
    # Same user -> login session ordering as refresh/logout.
    rows = (
        await session.scalars(
            select(LoginSession)
            .where(LoginSession.user_id == user_id, LoginSession.revoked_at.is_(None))
            .order_by(LoginSession.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()
    for row in rows:
        row.revoked_at = now
        row.revocation_reason = reason


async def change_password(
    session: AsyncSession, actor: User, current_password: str, new_password: str
):
    user = await reauthenticate(session, actor, current_password)
    if current_password == new_password:
        raise DomainError("password_unchanged", "Choose a different password.", 422)
    user.hashed_password = await run_in_threadpool(hash_password, new_password)
    await revoke_all(session, user.id, "password_changed", datetime.now(UTC))
    await session.commit()


async def deactivate(session: AsyncSession, actor: User, password: str) -> datetime:
    user = await reauthenticate(session, actor, password)
    eligibility = await deactivation_eligibility(session, user)
    if not eligibility.can_deactivate:
        raise DomainError(
            "exchanges_unsettled",
            "Settle all pending, accepted and waiting exchanges before deactivating.",
            409,
        )
    # Holding the user lock prevents new proposals, acceptance, listing creation and campus changes.
    listings = (
        await session.scalars(
            select(BookListing)
            .where(BookListing.owner_id == user.id)
            .order_by(BookListing.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()
    for listing in listings:
        listing.is_archived = True
    membership = await session.scalar(
        select(Membership).where(Membership.user_id == user.id).with_for_update()
    )
    if membership is not None:
        membership.active = False
        # Do not keep pending identity evidence after the user leaves.
        membership.document = None
        membership.document_type = None
        membership.document_expires_at = None
        if membership.status == "PENDING":
            membership.status = "NOT_SUBMITTED"
            membership.submission_id = None
    now = datetime.now(UTC)
    user.is_active = False
    user.deactivated_at = now
    await revoke_all(session, user.id, "account_deactivated", now)
    await session.commit()
    return now
