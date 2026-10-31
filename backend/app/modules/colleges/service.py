from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.colleges.directory import directory_lock, require_active_campus
from app.modules.colleges.models import Membership
from app.modules.colleges.policies import require_browsing
from app.modules.colleges.schemas import ReviewInput
from app.modules.notifications.events import NotificationKind as Kind
from app.modules.notifications.service import notify, notify_admins
from app.modules.users.models import User


async def locked_user(session: AsyncSession, user_id: UUID) -> User:
    await directory_lock(session)
    return await session.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update(key_share=True)
        .execution_options(populate_existing=True)
    )


async def submit_proof(
    session: AsyncSession, actor: User, document: bytes, content_type: str
) -> Membership:
    user = await locked_user(session, actor.id)
    if not user.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    await require_active_campus(session, user.campus_id)
    require_browsing(name=user.display_name, campus_id=user.campus_id)
    membership = await session.scalar(
        select(Membership).where(Membership.user_id == user.id).with_for_update()
    )
    if membership is None or not membership.active:
        raise DomainError("membership_unavailable", "Contact support about your membership.")
    if membership.status == "PENDING":
        raise DomainError("review_pending", "A submission is already pending.", 409)
    if (
        membership.status == "VERIFIED"
        and membership.expires_at
        and membership.expires_at > datetime.now(UTC)
    ):
        raise DomainError("already_verified", "Your membership is already verified.", 409)
    if membership.status == "REVOKED":
        raise DomainError("membership_revoked", "Contact support about your membership.")
    membership.submission_id = uuid4()
    membership.document = document
    membership.document_type = content_type
    membership.document_expires_at = datetime.now(UTC) + timedelta(days=7)
    membership.status = "PENDING"
    membership.expires_at = None
    membership.reviewed_by = None
    membership.reviewed_at = None
    membership.review_reason = None
    await session.flush()
    await notify_admins(
        session,
        Kind.MEMBERSHIP_SUBMITTED,
        membership.id,
        f"membership:{membership.submission_id}:submitted",
        exclude=[actor.id],
    )
    await session.commit()
    return membership


async def review_submission(
    session: AsyncSession, actor: User, submission_id: UUID, data: ReviewInput
) -> Membership:
    # Enforce again here so jobs/tests cannot bypass the request dependency.
    if not actor.is_active or not actor.is_admin:
        raise DomainError("reviewer_required", "Reviewer access required.")
    user_id = await session.scalar(
        select(Membership.user_id).where(Membership.submission_id == submission_id)
    )
    if user_id is None:
        raise DomainError("submission_changed", "Submission no longer exists.", 409)
    if user_id == actor.id:
        raise DomainError("self_review", "You cannot review your own membership.")
    user = await locked_user(session, user_id)
    membership = await session.scalar(
        select(Membership)
        .where(Membership.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    now = datetime.now(UTC)
    if (
        membership.submission_id != submission_id
        or membership.status != "PENDING"
        or membership.campus_id != user.campus_id
    ):
        raise DomainError("submission_changed", "Submission changed; reload the review.", 409)
    if (
        not user.is_active
        or not membership.active
        or membership.document_expires_at is None
        or membership.document_expires_at <= now
    ):
        raise DomainError("submission_expired", "Submission unavailable; request fresh proof.", 409)
    if data.decision == "VERIFIED" and (data.expires_at is None or data.expires_at <= now):
        raise DomainError("invalid_expiration", "Enrollment expiration must be in the future.", 422)
    if data.decision == "VERIFIED":
        await require_active_campus(session, user.campus_id)
    membership.status = data.decision
    membership.reviewed_by = actor.id
    membership.reviewed_at = now
    membership.review_reason = data.reason
    membership.expires_at = data.expires_at if data.decision == "VERIFIED" else None
    # Minimize sensitive-data retention: erase evidence once the decision is recorded.
    membership.document = None
    membership.document_type = None
    membership.document_expires_at = None
    kind = Kind.MEMBERSHIP_APPROVED if data.decision == "VERIFIED" else Kind.MEMBERSHIP_REJECTED
    await notify(session, [user.id], kind, membership.id, f"membership:{submission_id}:reviewed")
    await session.commit()
    return membership


async def purge_expired_proof(session: AsyncSession) -> int:
    # Same user-first lock as submission/review. Recheck deadlines after acquiring it.
    ids = list(
        (
            await session.scalars(
                select(Membership.user_id)
                .where(
                    Membership.document_expires_at <= datetime.now(UTC),
                    Membership.status == "PENDING",
                )
                .order_by(Membership.user_id)
                .limit(100)
            )
        ).all()
    )
    count = 0
    for user_id in ids:
        await locked_user(session, user_id)
        membership = await session.scalar(
            select(Membership)
            .where(Membership.user_id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if (
            membership.status == "PENDING"
            and membership.document_expires_at is not None
            and membership.document_expires_at <= datetime.now(UTC)
        ):
            membership.document = None
            membership.document_type = None
            membership.document_expires_at = None
            membership.status = "REJECTED"
            membership.review_reason = "Proof expired before review. Please resubmit."
            await notify(
                session,
                [user_id],
                Kind.MEMBERSHIP_PROOF_EXPIRED,
                membership.id,
                f"membership:{membership.submission_id}:proof_expired",
            )
            count += 1
        await session.commit()
    return count
