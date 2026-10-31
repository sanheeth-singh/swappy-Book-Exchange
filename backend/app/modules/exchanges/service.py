from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.books.models import BookListing, PhysicalBook
from app.modules.books.queries import listings
from app.modules.colleges.directory import require_active_campus
from app.modules.colleges.models import Membership
from app.modules.colleges.policies import require_browsing, require_participation
from app.modules.exchanges.models import Exchange, ExchangeIssue, Reservation
from app.modules.exchanges.policies import (
    ACTIVE_STATUSES,
    RESERVED_STATUSES,
    confirmation_state,
    require_transition,
    should_expire,
)
from app.modules.exchanges.presenters import snapshot
from app.modules.exchanges.queries import reject_pending
from app.modules.exchanges.schemas import ProposalInput, ResolutionInput
from app.modules.moderation.policies import require_publication_allowed
from app.modules.moderation.queries import require_interaction_allowed
from app.modules.notifications.events import NotificationKind as Kind
from app.modules.notifications.service import notify, notify_admins
from app.modules.users.models import User
from app.modules.users.queries import lock_users


async def lock_resources(
    session: AsyncSession,
    user_ids: list[UUID],
    listing_ids: list[UUID],
) -> tuple[dict[UUID, User], dict[UUID, BookListing], dict[UUID, PhysicalBook]]:
    # Lock order: users -> listings -> physical books -> exchange rows.
    # User and listing UUID order is deterministic, including reversed proposals.
    users = await lock_users(session, user_ids)
    books = {}
    for lid in sorted(set(listing_ids)):
        book = await session.scalar(
            listings()
            .where(BookListing.id == lid)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if book is None:
            raise DomainError("book_not_found", "Book not found.", 404)
        books[lid] = book
    physical = {}
    for bid in sorted({book.physical_book_id for book in books.values()}):
        physical[bid] = await session.scalar(
            select(PhysicalBook)
            .where(PhysicalBook.id == bid)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    return users, books, physical


async def require_eligible(session: AsyncSession, users: dict[UUID, User], campus_id: UUID):
    await require_active_campus(session, campus_id)
    for user in users.values():
        if not user.is_active:
            raise DomainError("participant_inactive", "Both accounts must be active.")
        require_publication_allowed(user.is_participation_restricted)
        require_browsing(name=user.display_name, campus_id=user.campus_id)
        if user.campus_id != campus_id:
            raise DomainError("campus_mismatch", "Both students must belong to this campus.")
        # Holding the user lock prevents concurrent membership mutations.
        membership = await session.scalar(
            select(Membership)
            .where(Membership.user_id == user.id)
            .execution_options(populate_existing=True)
        )
        if membership is None:
            raise DomainError("membership_required", "Both students must be verified.")
        require_participation(
            status=membership.status,
            active=membership.active,
            campus_id=membership.campus_id,
            selected_campus_id=user.campus_id,
            expires_at=membership.expires_at,
        )


async def require_available(
    session: AsyncSession,
    requested: BookListing,
    offered: BookListing,
    physical: dict[UUID, PhysicalBook],
    requester_id: UUID,
    owner_id: UUID,
):
    if (
        requested.owner_id != owner_id
        or offered.owner_id != requester_id
        or physical[requested.physical_book_id].owner_id != owner_id
        or physical[offered.physical_book_id].owner_id != requester_id
        or requested.physical_book_id == offered.physical_book_id
        or requested.campus_id != offered.campus_id
        or requested.is_hidden
        or offered.is_hidden
        or requested.is_archived
        or offered.is_archived
    ):
        raise DomainError("books_ineligible", "Books or owners are no longer eligible.", 409)
    reserved = await session.scalar(
        select(Reservation.physical_book_id)
        .where(Reservation.physical_book_id.in_(list(physical)))
        .limit(1)
    )
    if reserved:
        raise DomainError("book_reserved", "One of these books is already reserved.", 409)


async def commit(session: AsyncSession):
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DomainError(
            "exchange_conflict",
            "A competing action changed these books. Reload and try again.",
            409,
        ) from exc


async def propose(session: AsyncSession, actor: User, data: ProposalInput) -> Exchange:
    requested = await session.get(BookListing, data.requested_listing_id)
    offered = await session.get(BookListing, data.offered_listing_id)
    if requested is None or offered is None:
        raise DomainError("book_not_found", "Book not found.", 404)
    if requested.campus_id != actor.campus_id or offered.campus_id != actor.campus_id:
        raise DomainError("book_not_found", "Book not found.", 404)
    if requested.owner_id == actor.id or offered.owner_id != actor.id:
        raise DomainError(
            "invalid_ownership", "Offer your own book for another student's book.", 422
        )
    users, books, physical = await lock_resources(
        session,
        [actor.id, requested.owner_id],
        [data.requested_listing_id, data.offered_listing_id],
    )
    requested, offered = books[data.requested_listing_id], books[data.offered_listing_id]
    await require_eligible(session, users, requested.campus_id)
    await require_interaction_allowed(session, actor.id, requested.owner_id)
    await require_available(session, requested, offered, physical, actor.id, requested.owner_id)
    pair = [requested.id, offered.id]
    existing = await session.scalar(
        select(Exchange.id)
        .where(
            Exchange.status.in_(ACTIVE_STATUSES),
            Exchange.requested_listing_id.in_(pair),
            Exchange.offered_listing_id.in_(pair),
        )
        .limit(1)
    )
    if existing:
        raise DomainError(
            "duplicate_proposal", "An active proposal already exists for these books.", 409
        )
    exchange = Exchange(
        requester_id=actor.id,
        owner_id=requested.owner_id,
        campus_id=requested.campus_id,
        requested_listing_id=requested.id,
        offered_listing_id=offered.id,
        requested_snapshot=snapshot(requested),
        offered_snapshot=snapshot(offered),
        requester_name=users[actor.id].display_name,
        owner_name=users[requested.owner_id].display_name,
    )
    session.add(exchange)
    await session.flush()
    await notify(
        session,
        [exchange.owner_id],
        Kind.EXCHANGE_PROPOSED,
        exchange.id,
        f"exchange:{exchange.id}:proposed",
    )
    await commit(session)
    return exchange


async def locked_exchange(session: AsyncSession, exchange_id: UUID, actor: User | None):
    initial = await session.get(Exchange, exchange_id)
    if initial is None or (
        actor is not None
        and actor.id not in (initial.requester_id, initial.owner_id)
        and not actor.is_admin
    ):
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    users, books, physical = await lock_resources(
        session,
        [initial.requester_id, initial.owner_id],
        [initial.requested_listing_id, initial.offered_listing_id],
    )
    exchange = await session.scalar(
        select(Exchange)
        .where(Exchange.id == exchange_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return exchange, users, books, physical


async def release(session: AsyncSession, exchange: Exchange):
    await session.execute(delete(Reservation).where(Reservation.exchange_id == exchange.id))
    await session.execute(
        update(ExchangeIssue)
        .where(ExchangeIssue.exchange_id == exchange.id, ExchangeIssue.status == "OPEN")
        .values(status="RESOLVED")
    )


async def expire_if_due(session: AsyncSession, exchange: Exchange, now: datetime) -> bool:
    if should_expire(
        exchange.status,
        exchange.expires_at,
        exchange.requester_confirmed,
        exchange.owner_confirmed,
        now,
    ):
        exchange.status = "EXPIRED"
        await release(session, exchange)
        await notify(
            session,
            [exchange.requester_id, exchange.owner_id],
            Kind.EXCHANGE_EXPIRED,
            exchange.id,
            f"exchange:{exchange.id}:expired",
        )
        return True
    return False


async def complete(
    session: AsyncSession,
    exchange: Exchange,
    books: dict[UUID, BookListing],
    physical: dict[UUID, PhysicalBook],
    now: datetime,
):
    requested = books[exchange.requested_listing_id]
    offered = books[exchange.offered_listing_id]
    if (
        physical[requested.physical_book_id].owner_id != exchange.owner_id
        or physical[offered.physical_book_id].owner_id != exchange.requester_id
    ):
        raise DomainError("ownership_changed", "Ownership needs administrator review.", 409)
    reservations = (
        await session.scalars(
            select(Reservation.physical_book_id).where(Reservation.exchange_id == exchange.id)
        )
    ).all()
    if set(reservations) != set(physical):
        raise DomainError("reservation_changed", "Reservations need administrator review.", 409)
    physical[requested.physical_book_id].owner_id = exchange.requester_id
    physical[offered.physical_book_id].owner_id = exchange.owner_id
    requested.is_archived = offered.is_archived = True
    exchange.status = "COMPLETED"
    exchange.requester_confirmed = exchange.owner_confirmed = True
    exchange.completed_at = now
    await release(session, exchange)
    await reject_pending(session, [requested.id, offered.id], exclude=exchange.id)


async def act(session: AsyncSession, actor: User, exchange_id: UUID, action: str) -> Exchange:
    exchange, users, books, physical = await locked_exchange(session, exchange_id, actor)
    if actor.id not in (exchange.requester_id, exchange.owner_id):
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    if not users[actor.id].is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    require_transition(action, exchange.status, actor.id, exchange.requester_id, exchange.owner_id)
    before = (exchange.status, exchange.requester_confirmed, exchange.owner_confirmed)
    now = datetime.now(UTC)
    if await expire_if_due(session, exchange, now):
        await commit(session)
        return exchange
    if action == "accept":
        await require_eligible(session, users, exchange.campus_id)
        await require_interaction_allowed(session, exchange.requester_id, exchange.owner_id)
        requested, offered = (
            books[exchange.requested_listing_id],
            books[exchange.offered_listing_id],
        )
        await require_available(
            session,
            requested,
            offered,
            physical,
            exchange.requester_id,
            exchange.owner_id,
        )
        exchange.status = "ACCEPTED"
        exchange.accepted_at = now
        exchange.expires_at = now + timedelta(days=6)
        for bid in physical:
            session.add(Reservation(physical_book_id=bid, exchange_id=exchange.id))
        await reject_pending(session, list(books), exclude=exchange.id)
    elif action in ("reject", "cancel"):
        exchange.status = "REJECTED" if action == "reject" else "CANCELLED"
        await release(session, exchange)
    elif action == "confirm" and exchange.status != "COMPLETED":
        # Confirmation explicitly means "I received the offered/requested book".
        # A participant may finish an existing handover after membership expiry.
        issue = await session.scalar(
            select(ExchangeIssue.id)
            .where(ExchangeIssue.exchange_id == exchange.id, ExchangeIssue.status == "OPEN")
            .limit(1)
        )
        if issue:
            raise DomainError("issue_open", "An administrator must resolve the open issue.", 409)
        requester_confirmed = exchange.requester_confirmed or actor.id == exchange.requester_id
        owner_confirmed = exchange.owner_confirmed or actor.id == exchange.owner_id
        if confirmation_state(requester_confirmed, owner_confirmed) == "COMPLETED":
            await complete(session, exchange, books, physical, now)
        else:
            exchange.requester_confirmed = requester_confirmed
            exchange.owner_confirmed = owner_confirmed
            exchange.status = "WAITING_CONFIRMATION"
    after = (exchange.status, exchange.requester_confirmed, exchange.owner_confirmed)
    if after != before:
        counterpart = (
            exchange.owner_id if actor.id == exchange.requester_id else exchange.requester_id
        )
        kinds = {
            "ACCEPTED": Kind.EXCHANGE_ACCEPTED,
            "REJECTED": Kind.EXCHANGE_REJECTED,
            "CANCELLED": Kind.EXCHANGE_CANCELLED,
            "WAITING_CONFIRMATION": Kind.EXCHANGE_CONFIRMATION,
            "COMPLETED": Kind.EXCHANGE_COMPLETED,
        }
        kind = kinds[exchange.status]
        recipients = (
            [exchange.requester_id, exchange.owner_id]
            if exchange.status == "COMPLETED"
            else [counterpart]
        )
        key_suffix = (
            f"confirmation:{actor.id}"
            if exchange.status == "WAITING_CONFIRMATION"
            else exchange.status.lower()
        )
        await notify(session, recipients, kind, exchange.id, f"exchange:{exchange.id}:{key_suffix}")
    await commit(session)
    return exchange


async def report_issue(
    session: AsyncSession,
    actor: User,
    exchange_id: UUID,
    explanation: str,
) -> ExchangeIssue:
    exchange, users, _, _ = await locked_exchange(session, exchange_id, actor)
    if actor.id not in (exchange.requester_id, exchange.owner_id):
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    if not users[actor.id].is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    if exchange.status not in RESERVED_STATUSES:
        raise DomainError(
            "issue_not_available", "Issues require an unresolved accepted exchange.", 409
        )
    existing = await session.scalar(
        select(ExchangeIssue.id).where(
            ExchangeIssue.exchange_id == exchange.id,
            ExchangeIssue.reported_by == actor.id,
            ExchangeIssue.status == "OPEN",
        )
    )
    if existing:
        raise DomainError("issue_exists", "You already have an open issue for this exchange.", 409)
    issue = ExchangeIssue(
        exchange_id=exchange.id,
        reported_by=actor.id,
        explanation=explanation,
    )
    session.add(issue)
    await session.flush()
    other = exchange.owner_id if actor.id == exchange.requester_id else exchange.requester_id
    await notify(session, [other], Kind.EXCHANGE_ISSUE, exchange.id, f"issue:{issue.id}:raised")
    await notify_admins(
        session,
        Kind.EXCHANGE_ISSUE,
        exchange.id,
        f"issue:{issue.id}:raised",
        exclude=[exchange.requester_id, exchange.owner_id],
    )
    await commit(session)
    return issue


async def resolve(
    session: AsyncSession,
    actor: User,
    exchange_id: UUID,
    data: ResolutionInput,
) -> Exchange:
    if not actor.is_admin or not actor.is_active:
        raise DomainError("admin_required", "Administrator access required.")
    exchange, _, books, physical = await locked_exchange(session, exchange_id, actor)
    if actor.id in (exchange.requester_id, exchange.owner_id):
        raise DomainError("self_resolution", "Another administrator must resolve your exchange.")
    if exchange.status not in RESERVED_STATUSES:
        raise DomainError("resolution_unavailable", "Exchange is already resolved.", 409)
    now = datetime.now(UTC)
    if data.decision == "COMPLETE":
        await complete(session, exchange, books, physical, now)
    else:
        exchange.status = "CANCELLED"
        await release(session, exchange)
    exchange.resolved_by = actor.id
    exchange.resolution_reason = data.reason
    exchange.resolved_at = now
    await notify(
        session,
        [exchange.requester_id, exchange.owner_id],
        Kind.EXCHANGE_RESOLVED,
        exchange.id,
        f"exchange:{exchange.id}:resolved",
    )
    await commit(session)
    return exchange


async def expire_batch(session: AsyncSession, limit: int = 100) -> int:
    ids = (
        await session.scalars(
            select(Exchange.id)
            .where(Exchange.status == "ACCEPTED", Exchange.expires_at <= datetime.now(UTC))
            .order_by(Exchange.expires_at, Exchange.id)
            .limit(limit)
        )
    ).all()
    count = 0
    # Commit each exchange; use the same locks as HTTP mutations.
    for exchange_id in ids:
        exchange, _, _, _ = await locked_exchange(session, exchange_id, None)
        count += int(await expire_if_due(session, exchange, datetime.now(UTC)))
        await commit(session)
    return count
