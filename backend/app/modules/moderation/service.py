from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.books.models import BookListing
from app.modules.books.queries import listings
from app.modules.books.schemas import BookResponse
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.queries import reject_pending
from app.modules.moderation.models import ModerationAction, Report, UserBlock
from app.modules.moderation.policies import require_not_self, require_review
from app.modules.moderation.queries import reject_pair_pending, reject_user_pending
from app.modules.moderation.schemas import ReportInput, RestoreResponse, ReviewInput
from app.modules.notifications.events import NotificationKind as Kind
from app.modules.notifications.service import notify, notify_admins
from app.modules.users.models import User
from app.modules.users.queries import lock_users


async def finish(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DomainError(
            "moderation_conflict", "A competing action changed this record. Reload.", 409
        ) from exc


def require_admin(actor: User) -> None:
    if not actor.is_admin or not actor.is_active:
        raise DomainError("admin_required", "Administrator access required.")


async def set_block(
    session: AsyncSession,
    actor: User,
    target_id: UUID,
    *,
    blocked: bool,
) -> None:
    if target_id is None:
        raise DomainError("invalid_target", "Choose a valid target.", 422)
    require_not_self(actor.id, target_id)
    users = await lock_users(session, [actor.id, target_id])
    if not users[actor.id].is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    existing = await session.scalar(
        select(UserBlock).where(
            UserBlock.blocker_id == actor.id,
            UserBlock.blocked_id == target_id,
        )
    )
    if blocked:
        if existing is None:
            session.add(UserBlock(blocker_id=actor.id, blocked_id=target_id))
        # Only pending proposals are invalidated. Accepted reservations are untouched.
        await reject_pair_pending(session, actor.id, target_id)
    elif existing is not None:
        await session.delete(existing)
    await finish(session)


async def can_report_listing(session: AsyncSession, actor: User, listing: BookListing) -> bool:
    if actor.campus_id == listing.campus_id and not listing.is_archived:
        return True  # Includes hidden/blocked listings so safety reporting still works.
    return bool(
        await session.scalar(
            select(Exchange.id)
            .where(
                or_(Exchange.requester_id == actor.id, Exchange.owner_id == actor.id),
                or_(
                    Exchange.requested_listing_id == listing.id,
                    Exchange.offered_listing_id == listing.id,
                ),
            )
            .limit(1)
        )
    )


async def submit_report(session: AsyncSession, actor: User, data: ReportInput) -> Report:
    target_id = data.target_user_id
    if data.listing_id is not None:
        initial = await session.get(BookListing, data.listing_id)
        if initial is None:
            raise DomainError("listing_not_found", "Listing not found.", 404)
        target_id = initial.owner_id
    if target_id is None:
        raise DomainError("invalid_target", "Choose a valid target.", 422)
    require_not_self(actor.id, target_id)
    users = await lock_users(session, [actor.id, target_id])
    reporter, target = users[actor.id], users[target_id]
    if not reporter.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    if data.listing_id is not None:
        listing = await session.scalar(
            listings()
            .where(BookListing.id == data.listing_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if not await can_report_listing(session, reporter, listing):
            raise DomainError("listing_not_found", "Listing not found.", 404)
        target_snapshot = BookResponse.model_validate(listing).model_dump(mode="json")
        duplicate_filter = Report.listing_id == listing.id
    else:
        # Known user IDs can be reported without onboarding or verification.
        # This snapshot is administrator-only; no profile discovery API is added.
        target_snapshot = {
            "id": str(target.id),
            "display_name": target.display_name,
            "campus_id": str(target.campus_id) if target.campus_id else None,
        }
        duplicate_filter = Report.target_user_id == target.id
    existing = await session.scalar(
        select(Report.id)
        .where(
            Report.reporter_id == reporter.id,
            Report.target_type == data.target_type,
            Report.status == "OPEN",
            duplicate_filter,
        )
        .limit(1)
    )
    if existing:
        raise DomainError("report_exists", "You already have an open report for this target.", 409)
    report = Report(
        reporter_id=reporter.id,
        target_user_id=target.id,
        target_type=data.target_type,
        listing_id=data.listing_id,
        reason=data.reason,
        details=data.details,
        target_snapshot=target_snapshot,
    )
    session.add(report)
    await session.flush()
    await notify_admins(
        session,
        Kind.REPORT_SUBMITTED,
        report.id,
        f"report:{report.id}:submitted",
        exclude=[report.reporter_id, report.target_user_id],
    )
    await finish(session)
    return report


async def review_report(
    session: AsyncSession,
    actor: User,
    report_id: UUID,
    data: ReviewInput,
) -> Report:
    require_admin(actor)
    initial = await session.get(Report, report_id)
    if initial is None:
        raise DomainError("report_not_found", "Report not found.", 404)
    users = await lock_users(session, [initial.target_user_id])
    target = users[initial.target_user_id]
    listing = None
    if initial.listing_id is not None:
        listing = await session.scalar(
            listings()
            .where(BookListing.id == initial.listing_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    report = await session.scalar(
        select(Report)
        .where(Report.id == report_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    require_review(
        actor.id,
        report.reporter_id,
        report.target_user_id,
        report.status,
        report.target_type,
        data.action,
    )
    if data.action == "HIDE_LISTING":
        listing.is_hidden = True
        await reject_pending(session, [listing.id])
    elif data.action == "RESTRICT_USER":
        target.is_participation_restricted = True
        await reject_user_pending(session, target.id)
    report.status = "DISMISSED" if data.action == "DISMISS" else "RESOLVED"
    report.reviewed_by = actor.id
    report.reviewed_at = datetime.now(UTC)
    report.action = data.action
    report.review_summary = data.summary
    audit_id = uuid4()
    session.add(
        ModerationAction(
            id=audit_id,
            actor_id=actor.id,
            target_user_id=target.id,
            listing_id=report.listing_id,
            report_id=report.id,
            action=data.action,
            note=data.summary,
        )
    )
    await notify(
        session,
        [report.reporter_id],
        Kind.REPORT_REVIEWED,
        report.id,
        f"report:{report.id}:reviewed",
    )
    if data.action == "HIDE_LISTING":
        await notify(
            session, [target.id], Kind.LISTING_HIDDEN, listing.id, f"moderation:{audit_id}:hidden"
        )
    elif data.action == "RESTRICT_USER":
        await notify(
            session,
            [target.id],
            Kind.PARTICIPATION_RESTRICTED,
            target.id,
            f"moderation:{audit_id}:restricted",
        )
    await finish(session)
    return report


async def restore_user(
    session: AsyncSession,
    actor: User,
    target_id: UUID,
    reason: str,
) -> RestoreResponse:
    require_admin(actor)
    if actor.id == target_id:
        raise DomainError("review_conflict", "Another administrator must restore your access.")
    target = (await lock_users(session, [target_id]))[target_id]
    changed = target.is_participation_restricted
    if changed:
        target.is_participation_restricted = False
        audit_id = uuid4()
        session.add(
            ModerationAction(
                id=audit_id,
                actor_id=actor.id,
                target_user_id=target_id,
                action="RESTORE_USER",
                note=reason,
            )
        )
        await notify(
            session,
            [target_id],
            Kind.PARTICIPATION_RESTORED,
            target_id,
            f"moderation:{audit_id}:restored",
        )
    await finish(session)
    return RestoreResponse(target_type="USER", target_id=target_id, changed=changed)


async def restore_listing(
    session: AsyncSession,
    actor: User,
    listing_id: UUID,
    reason: str,
) -> RestoreResponse:
    require_admin(actor)
    initial = await session.get(BookListing, listing_id)
    if initial is None:
        raise DomainError("listing_not_found", "Listing not found.", 404)
    if actor.id == initial.owner_id:
        raise DomainError("review_conflict", "Another administrator must restore your listing.")
    await lock_users(session, [initial.owner_id])
    listing = await session.scalar(
        listings()
        .where(BookListing.id == listing_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    changed = listing.is_hidden
    if changed:
        listing.is_hidden = False
        audit_id = uuid4()
        session.add(
            ModerationAction(
                id=audit_id,
                actor_id=actor.id,
                target_user_id=listing.owner_id,
                listing_id=listing.id,
                action="RESTORE_LISTING",
                note=reason,
            )
        )
        await notify(
            session,
            [listing.owner_id],
            Kind.LISTING_RESTORED,
            listing.id,
            f"moderation:{audit_id}:restored",
        )
    await finish(session)
    return RestoreResponse(target_type="LISTING", target_id=listing_id, changed=changed)
