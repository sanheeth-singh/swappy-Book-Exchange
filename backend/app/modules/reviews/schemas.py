from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: int = Field(ge=1, le=5, strict=True)
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Use plain text without control characters.")
        return value or None


class OwnReview(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exchange_id: UUID
    reviewer_id: UUID
    reviewed_user_id: UUID
    rating: int
    comment: str | None
    created_at: datetime
    published_at: datetime | None
    is_hidden: bool


class PublicReview(BaseModel):
    id: UUID
    reviewer_id: UUID
    reviewer_name: str | None
    reviewed_user_id: UUID
    rating: int
    comment: str | None
    created_at: datetime
    published_at: datetime


class ExchangeReviews(BaseModel):
    review_deadline: datetime | None
    can_review: bool
    my_review: OwnReview | None
    received_review: PublicReview | None


class ReviewPage(BaseModel):
    items: list[PublicReview]
    next_cursor: UUID | None


class Reputation(BaseModel):
    user_id: UUID
    average_rating: float | None
    review_count: int
    distinct_reviewers: int
    completed_exchanges: int
    distinct_exchange_partners: int
    trust_score: float | None
    trust_status: Literal["NOT_ENOUGH_HISTORY", "AVAILABLE"]
    trust_version: str
    minimum_distinct_reviewers: int = 3


class ModerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    action: Literal["HIDE", "RESTORE"]
    reason: str = Field(min_length=10, max_length=1000)


class AuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    review_id: UUID
    actor_id: UUID
    action: str
    reason: str
    created_at: datetime
