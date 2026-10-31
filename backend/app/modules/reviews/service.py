from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, case, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.colleges.policies import require_browsing
from app.modules.exchanges.models import Exchange
from app.modules.notifications.events import NotificationKind as Kind
from app.modules.notifications.service import notify
from app.modules.reviews.models import Review, ReviewModerationAction
from app.modules.reviews.policies import MIN_REVIEWERS, REVIEW_WINDOW, TRUST_VERSION, trust_score
from app.modules.reviews.schemas import (
    ExchangeReviews,
    OwnReview,
    PublicReview,
    Reputation,
    ReviewInput,
    ReviewPage,
)
from app.modules.users.models import User


def visible():
    return and_(Review.published_at.is_not(None), Review.is_hidden.is_(False))


async def exchange_for(session, actor, exchange_id, *, lock=False):
    query = select(Exchange).where(
        Exchange.id == exchange_id,
        or_(Exchange.requester_id == actor.id, Exchange.owner_id == actor.id),
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    exchange = await session.scalar(query)
    if exchange is None:
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    return exchange


async def publish_locked(session: AsyncSession, exchange: Exchange, now: datetime) -> int:
    """Caller holds exchange lock. Seal contents until both submissions or the deadline."""
    rows = list(
        (
            await session.scalars(
                select(Review)
                .where(Review.exchange_id == exchange.id)
                .order_by(Review.id)
                .with_for_update()
            )
        ).all()
    )
    if exchange.status != "COMPLETED" or exchange.completed_at is None:
        return 0
    if len(rows) < 2 and now < exchange.completed_at + REVIEW_WINDOW:
        return 0
    count = 0
    for review in rows:
        if review.published_at is None:
            review.published_at = now
            count += 1
            await notify(
                session,
                [review.reviewed_user_id],
                Kind.REVIEW_PUBLISHED,
                exchange.id,
                f"review:{review.id}:published",
            )
    return count


async def submit(session: AsyncSession, actor: User, exchange_id: UUID, data: ReviewInput):
    # Completed-exchange feedback rights survive blocks and eligibility expiry.
    # No user mutation locks are needed: order is exchange -> reviews -> notification inserts.
    exchange = await exchange_for(session, actor, exchange_id, lock=True)
    if exchange.status != "COMPLETED" or exchange.completed_at is None:
        raise DomainError("review_not_available", "Only completed exchanges can be reviewed.", 409)
    existing = await session.scalar(
        select(Review).where(Review.exchange_id == exchange_id, Review.reviewer_id == actor.id)
    )
    if existing:
        if existing.rating != data.rating or existing.comment != data.comment:
            raise DomainError(
                "review_exists",
                "You already reviewed this exchange. Reviews cannot be edited.",
                409,
            )
        await publish_locked(session, exchange, datetime.now(UTC))
        await session.commit()
        return existing
    now = datetime.now(UTC)
    if now >= exchange.completed_at + REVIEW_WINDOW:
        raise DomainError("review_window_closed", "The 14-day review window has ended.", 409)
    other = exchange.owner_id if actor.id == exchange.requester_id else exchange.requester_id
    review = Review(
        exchange_id=exchange_id,
        reviewer_id=actor.id,
        reviewed_user_id=other,
        rating=data.rating,
        comment=data.comment,
    )
    session.add(review)
    await session.flush()
    await publish_locked(session, exchange, now)
    await session.commit()
    return review


def public_response(review: Review, reviewer_name: str | None) -> PublicReview:
    return PublicReview(
        id=review.id,
        reviewer_id=review.reviewer_id,
        reviewer_name=reviewer_name,
        reviewed_user_id=review.reviewed_user_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        published_at=review.published_at,
    )


async def exchange_reviews(session: AsyncSession, actor: User, exchange_id: UUID):
    exchange = await exchange_for(session, actor, exchange_id)
    rows = list(
        (await session.scalars(select(Review).where(Review.exchange_id == exchange_id))).all()
    )
    own = next((row for row in rows if row.reviewer_id == actor.id), None)
    received = next(
        (
            row
            for row in rows
            if row.reviewed_user_id == actor.id
            and row.published_at is not None
            and not row.is_hidden
        ),
        None,
    )
    deadline = (exchange.completed_at + REVIEW_WINDOW) if exchange.completed_at else None
    return ExchangeReviews(
        review_deadline=deadline,
        can_review=exchange.status == "COMPLETED"
        and own is None
        and deadline is not None
        and datetime.now(UTC) < deadline,
        my_review=OwnReview.model_validate(own) if own else None,
        received_review=(
            public_response(received, (await session.get(User, received.reviewer_id)).display_name)
            if received
            else None
        ),
    )


async def require_profile_access(session, actor, target_id):
    target = await session.get(User, target_id)
    if target is None:
        raise DomainError("user_not_found", "User not found.", 404)
    if actor.id == target_id or actor.is_admin:
        return
    if actor.campus_id is not None and actor.campus_id == target.campus_id and target.is_active:
        require_browsing(name=actor.display_name, campus_id=actor.campus_id)
        return
    historical = await session.scalar(
        select(Exchange.id)
        .where(
            Exchange.status == "COMPLETED",
            or_(
                and_(Exchange.requester_id == actor.id, Exchange.owner_id == target_id),
                and_(Exchange.owner_id == actor.id, Exchange.requester_id == target_id),
            ),
        )
        .limit(1)
    )
    if historical is None:
        raise DomainError("user_not_found", "User not found.", 404)


async def list_reviews(session, actor, target_id, limit, before):
    await require_profile_access(session, actor, target_id)
    query = (
        select(Review, User.display_name)
        .join(User, User.id == Review.reviewer_id)
        .where(Review.reviewed_user_id == target_id, visible())
    )
    if before is not None:
        cursor = await session.scalar(
            select(Review).where(
                Review.id == before, Review.reviewed_user_id == target_id, visible()
            )
        )
        if cursor is None:
            raise DomainError(
                "review_not_found", "Review cursor not found. Reload the first page.", 404
            )
        query = query.where(
            tuple_(Review.published_at, Review.id) < (cursor.published_at, cursor.id)
        )
    rows = list(
        (
            await session.execute(
                query.order_by(Review.published_at.desc(), Review.id.desc()).limit(limit + 1)
            )
        ).all()
    )
    more = len(rows) > limit
    rows = rows[:limit]
    return ReviewPage(
        items=[public_response(review, name) for review, name in rows],
        next_cursor=rows[-1][0].id if more else None,
    )


async def reputation(session, actor, target_id):
    await require_profile_access(session, actor, target_id)
    # One snapshot for all review-derived values; each distinct reviewer has equal score weight.
    groups = (
        await session.execute(
            select(Review.reviewer_id, func.count(Review.id), func.sum(Review.rating))
            .where(Review.reviewed_user_id == target_id, visible())
            .group_by(Review.reviewer_id)
        )
    ).all()
    count = sum(n for _, n, _ in groups)
    mean = Decimal(sum(total for _, _, total in groups)) / count if count else None
    means = [Decimal(total) / n for _, n, total in groups]
    completed, partners = (
        await session.execute(
            select(
                func.count(Exchange.id),
                func.count(
                    func.distinct(
                        case(
                            (Exchange.requester_id == target_id, Exchange.owner_id),
                            else_=Exchange.requester_id,
                        )
                    )
                ),
            ).where(
                Exchange.status == "COMPLETED",
                or_(Exchange.requester_id == target_id, Exchange.owner_id == target_id),
            )
        )
    ).one()
    score = trust_score([Decimal(value) for value in means])
    return Reputation(
        user_id=target_id,
        average_rating=round(float(mean), 2) if mean is not None else None,
        review_count=count,
        distinct_reviewers=len(means),
        completed_exchanges=completed,
        distinct_exchange_partners=partners,
        trust_score=float(score) if score is not None else None,
        trust_status="AVAILABLE" if score is not None else "NOT_ENOUGH_HISTORY",
        trust_version=TRUST_VERSION,
        minimum_distinct_reviewers=MIN_REVIEWERS,
    )


async def moderate(session, actor, review_id, data):
    if not actor.is_admin or not actor.is_active:
        raise DomainError("admin_required", "Administrator access required.")
    review = await session.scalar(
        select(Review)
        .where(Review.id == review_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if review is None or review.published_at is None:
        raise DomainError("review_not_found", "Published review not found.", 404)
    if actor.id in (review.reviewer_id, review.reviewed_user_id):
        raise DomainError("self_moderation", "Another administrator must moderate this review.")
    hidden = data.action == "HIDE"
    if review.is_hidden != hidden:
        review.is_hidden = hidden
        audit = ReviewModerationAction(
            review_id=review_id, actor_id=actor.id, action=data.action, reason=data.reason
        )
        session.add(audit)
        await session.flush()
        await notify(
            session,
            [review.reviewer_id, review.reviewed_user_id],
            Kind.REVIEW_MODERATED,
            review.exchange_id,
            f"review-action:{audit.id}",
        )
    await session.commit()
    return review


async def publish_batch(session: AsyncSession, limit: int = 100) -> int:
    now = datetime.now(UTC)
    ids = list(
        (
            await session.scalars(
                select(Exchange.id)
                .where(
                    Exchange.status == "COMPLETED",
                    Exchange.completed_at <= now - REVIEW_WINDOW,
                    select(Review.id)
                    .where(Review.exchange_id == Exchange.id, Review.published_at.is_(None))
                    .exists(),
                )
                .order_by(Exchange.completed_at, Exchange.id)
                .limit(limit)
            )
        ).all()
    )
    for eid in ids:
        exchange = await session.scalar(
            select(Exchange)
            .where(Exchange.id == eid)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        await publish_locked(session, exchange, datetime.now(UTC))
        await session.commit()
    return len(ids)
