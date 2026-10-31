from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class Review(IdentityMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("exchange_id", "reviewer_id", name="uq_reviews_exchange_reviewer"),
        CheckConstraint("reviewer_id <> reviewed_user_id", name="not_self"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating"),
        CheckConstraint(
            "comment IS NULL OR char_length(comment) BETWEEN 1 AND 2000", name="comment_length"
        ),
        Index("ix_reviews_public_user", "reviewed_user_id", "published_at", "id"),
        Index(
            "ix_reviews_pending_publication",
            "exchange_id",
            postgresql_where=text("published_at IS NULL"),
        ),
    )
    exchange_id: Mapped[UUID] = mapped_column(ForeignKey("exchanges.id"))
    reviewer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    reviewed_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(String(2000))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class ReviewModerationAction(IdentityMixin, Base):
    __tablename__ = "review_moderation_actions"
    __table_args__ = (
        CheckConstraint("action IN ('HIDE','RESTORE')", name="action"),
        Index("ix_review_moderation_review", "review_id", "created_at"),
    )
    review_id: Mapped[UUID] = mapped_column(ForeignKey("reviews.id"))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str] = mapped_column(String(1000))
