from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.books.genres import Genre, genres_from_interests
from app.modules.books.models import BookListing, PhysicalBook
from app.modules.books.queries import discoverable_listings
from app.modules.books.schemas import BookResponse, RecommendationItem, RecommendationResponse
from app.modules.colleges.models import Membership
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.policies import ACTIVE_STATUSES
from app.modules.users.models import User

MAX_RECOMMENDATIONS = 5
HISTORY_BOOKS = 20


def history_query(user_id: UUID):
    # One latest non-hidden publication per physical copy: relisting cannot add genre weight.
    own = aliased(BookListing)
    ranked = (
        select(
            own.genre,
            own.created_at,
            own.id,
            func.row_number()
            .over(
                partition_by=own.physical_book_id, order_by=(own.created_at.desc(), own.id.desc())
            )
            .label("position"),
        )
        .where(own.owner_id == user_id, own.is_hidden.is_(False))
        .subquery()
    )
    return (
        select(ranked.c.genre)
        .where(ranked.c.position == 1)
        .order_by(ranked.c.created_at.desc(), ranked.c.id.desc())
        .limit(HISTORY_BOOKS)
    )


def candidate_query(actor: User, genres: set[Genre], now: datetime):
    owner_membership = (
        select(Membership.id)
        .join(User, User.id == Membership.user_id)
        .where(
            Membership.user_id == BookListing.owner_id,
            Membership.campus_id == actor.campus_id,
            Membership.status == "VERIFIED",
            Membership.active.is_(True),
            User.campus_id == actor.campus_id,
            or_(Membership.expires_at.is_(None), Membership.expires_at > now),
        )
        .correlate_except(Membership, User)
        .exists()
    )
    current_copy = (
        select(PhysicalBook.id)
        .where(
            PhysicalBook.id == BookListing.physical_book_id,
            PhysicalBook.owner_id == BookListing.owner_id,
            PhysicalBook.owner_id != actor.id,
        )
        .correlate_except(PhysicalBook)
        .exists()
    )
    already_involved = (
        select(Exchange.id)
        .where(
            Exchange.status.in_(ACTIVE_STATUSES),
            or_(Exchange.requester_id == actor.id, Exchange.owner_id == actor.id),
            or_(
                Exchange.requested_listing_id == BookListing.id,
                Exchange.offered_listing_id == BookListing.id,
            ),
        )
        .correlate_except(Exchange)
        .exists()
    )
    previous = aliased(BookListing)
    previously_listed = (
        select(previous.id)
        .where(
            previous.owner_id == actor.id,
            previous.physical_book_id == BookListing.physical_book_id,
        )
        .correlate_except(previous)
        .exists()
    )
    priority = case((BookListing.genre.in_(sorted(genres)), 0), else_=1)
    return (
        discoverable_listings(actor.id)
        .where(
            BookListing.campus_id == actor.campus_id,
            BookListing.owner_id != actor.id,
            BookListing.is_reserved.is_(False),
            owner_membership,
            current_copy,
            ~already_involved,
            ~previously_listed,
        )
        .order_by(priority, BookListing.created_at.desc(), BookListing.id.desc())
        .limit(MAX_RECOMMENDATIONS)
    )


async def recommend(session: AsyncSession, actor: User) -> RecommendationResponse:
    history = set((await session.scalars(history_query(actor.id))).all())
    history.discard(None)
    history.discard(Genre.OTHER)
    history_genres = {Genre(value) for value in history}
    interests = genres_from_interests(actor.reading_interests)
    genres = history_genres | interests
    sources = []
    if history_genres:
        sources.append("LISTING_HISTORY")
    if interests:
        sources.append("READING_INTERESTS")
    rows = (await session.scalars(candidate_query(actor, genres, datetime.now(UTC)))).all()
    return RecommendationResponse(
        items=[
            RecommendationItem(
                book=BookResponse.model_validate(row),
                reason="GENRE_MATCH" if row.genre in genres else "RECENT_AVAILABLE",
            )
            for row in rows
        ],
        preferred_genres=sorted(genres),
        preference_sources=sources,
    )
