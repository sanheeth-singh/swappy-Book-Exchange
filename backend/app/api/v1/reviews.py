from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.dependencies.authentication import AdminUser, CurrentUser
from app.api.dependencies.database import Session
from app.modules.reviews import service
from app.modules.reviews.models import Review, ReviewModerationAction
from app.modules.reviews.schemas import (
    AuditResponse,
    ExchangeReviews,
    ModerationInput,
    OwnReview,
    Reputation,
    ReviewInput,
    ReviewPage,
)

router = APIRouter(tags=["reviews and reputation"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post("/exchanges/{exchange_id}/reviews", response_model=OwnReview)
async def submit(exchange_id: UUID, data: ReviewInput, actor: CurrentUser, session: Session):
    return await service.submit(session, actor, exchange_id, data)


@router.get("/exchanges/{exchange_id}/reviews", response_model=ExchangeReviews)
async def exchange_reviews(exchange_id: UUID, actor: CurrentUser, session: Session):
    return await service.exchange_reviews(session, actor, exchange_id)


@router.get("/users/{user_id}/reviews", response_model=ReviewPage)
async def user_reviews(
    user_id: UUID,
    actor: CurrentUser,
    session: Session,
    limit: Limit = 20,
    before: UUID | None = None,
):
    return await service.list_reviews(session, actor, user_id, limit, before)


@router.get("/users/{user_id}/reputation", response_model=Reputation)
async def reputation(user_id: UUID, actor: CurrentUser, session: Session):
    return await service.reputation(session, actor, user_id)


@router.get("/moderation/reviews", response_model=list[OwnReview])
async def queue(
    actor: AdminUser, session: Session, hidden: bool = False, limit: Limit = 20, offset: Offset = 0
):
    return (
        await session.scalars(
            select(Review)
            .where(Review.published_at.is_not(None), Review.is_hidden == hidden)
            .order_by(Review.published_at.desc(), Review.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()


@router.post("/moderation/reviews/{review_id}", response_model=OwnReview)
async def moderate(review_id: UUID, data: ModerationInput, actor: AdminUser, session: Session):
    return await service.moderate(session, actor, review_id, data)


@router.get("/moderation/reviews/{review_id}/actions", response_model=list[AuditResponse])
async def actions(
    review_id: UUID, actor: AdminUser, session: Session, limit: Limit = 20, offset: Offset = 0
):
    return (
        await session.scalars(
            select(ReviewModerationAction)
            .where(ReviewModerationAction.review_id == review_id)
            .order_by(ReviewModerationAction.created_at.desc(), ReviewModerationAction.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
