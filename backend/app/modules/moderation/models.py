from datetime import datetime
from uuid import UUID

from pydantic import JsonValue
from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class UserBlock(IdentityMixin, Base):
    __tablename__ = "user_blocks"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
        CheckConstraint("blocker_id <> blocked_id", name="not_self"),
        Index("ix_user_blocks_blocked_id", "blocked_id"),
    )
    blocker_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    blocked_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))


class Report(IdentityMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("reporter_id <> target_user_id", name="not_self"),
        CheckConstraint(
            "(target_type = 'USER' AND listing_id IS NULL) OR "
            "(target_type = 'LISTING' AND listing_id IS NOT NULL)",
            name="target",
        ),
        CheckConstraint(
            "reason IN ('SPAM','HARASSMENT','INAPPROPRIATE_CONTENT','MISLEADING_LISTING','OTHER')",
            name="reason",
        ),
        CheckConstraint("status IN ('OPEN','RESOLVED','DISMISSED')", name="status"),
        CheckConstraint(
            "(status = 'OPEN' AND reviewed_at IS NULL AND reviewed_by IS NULL AND action IS NULL) "
            "OR (status <> 'OPEN' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL "
            "AND action IS NOT NULL)",
            name="review_state",
        ),
        CheckConstraint(
            "action IS NULL OR action IN ('DISMISS','RESOLVE','HIDE_LISTING','RESTRICT_USER')",
            name="action",
        ),
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_status_created_at", "status", "created_at"),
        Index(
            "uq_reports_open_user",
            "reporter_id",
            "target_user_id",
            unique=True,
            postgresql_where=text("status = 'OPEN' AND target_type = 'USER'"),
        ),
        Index(
            "uq_reports_open_listing",
            "reporter_id",
            "listing_id",
            unique=True,
            postgresql_where=text("status = 'OPEN' AND target_type = 'LISTING'"),
        ),
    )
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_type: Mapped[str] = mapped_column(String(10))
    listing_id: Mapped[UUID | None] = mapped_column(ForeignKey("book_listings.id"))
    reason: Mapped[str] = mapped_column(String(30))
    details: Mapped[str] = mapped_column(String(2000), default="")
    target_snapshot: Mapped[dict[str, JsonValue]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(12), default="OPEN")
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    action: Mapped[str | None] = mapped_column(String(20))
    review_summary: Mapped[str | None] = mapped_column(String(1000))


class ModerationAction(IdentityMixin, Base):
    __tablename__ = "moderation_actions"
    __table_args__ = (
        CheckConstraint(
            "action IN ('DISMISS','RESOLVE','HIDE_LISTING','RESTRICT_USER',"
            "'RESTORE_LISTING','RESTORE_USER')",
            name="action",
        ),
        Index("ix_moderation_actions_target_user_id", "target_user_id"),
    )
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    listing_id: Mapped[UUID | None] = mapped_column(ForeignKey("book_listings.id"))
    report_id: Mapped[UUID | None] = mapped_column(ForeignKey("reports.id"))
    action: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(String(1000))
