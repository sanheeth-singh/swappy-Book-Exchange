from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class College(IdentityMixin, Base):
    __tablename__ = "colleges"
    __table_args__ = (
        Index(
            "uq_colleges_normalized_name",
            text("lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))"),
            unique=True,
        ),
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    name: Mapped[str] = mapped_column(String(200), unique=True)


class Campus(IdentityMixin, Base):
    __tablename__ = "campuses"
    __table_args__ = (
        Index(
            "uq_campuses_normalized_location",
            "college_id",
            text("lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))"),
            text("lower(regexp_replace(btrim(city), '[[:space:]]+', ' ', 'g'))"),
            unique=True,
        ),
    )
    college_id: Mapped[UUID] = mapped_column(ForeignKey("colleges.id"))
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Membership(IdentityMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (
        CheckConstraint(
            "status IN ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED','REVOKED')", name="status"
        ),
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    campus_id: Mapped[UUID] = mapped_column(ForeignKey("campuses.id"))
    status: Mapped[str] = mapped_column(String(20), default="NOT_SUBMITTED")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submission_id: Mapped[UUID | None] = mapped_column(unique=True)
    document: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    document_type: Mapped[str | None] = mapped_column(String(30))
    document_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reason: Mapped[str | None] = mapped_column(String(500))


class DirectoryAction(IdentityMixin, Base):
    __tablename__ = "directory_actions"
    __table_args__ = (
        CheckConstraint("source IN ('ADMIN','CLI')", name="source"),
        CheckConstraint(
            "(source = 'ADMIN' AND actor_id IS NOT NULL) OR (source = 'CLI' AND actor_id IS NULL)",
            name="actor_source",
        ),
        CheckConstraint(
            "action IN ('CREATE_COLLEGE','EDIT_COLLEGE','ACTIVATE_COLLEGE','DEACTIVATE_COLLEGE',"
            "'CREATE_CAMPUS','EDIT_CAMPUS','ACTIVATE_CAMPUS','DEACTIVATE_CAMPUS')",
            name="action",
        ),
        Index("ix_directory_actions_college", "college_id", "created_at"),
        Index("ix_directory_actions_campus", "campus_id", "created_at"),
    )
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(10))
    college_id: Mapped[UUID] = mapped_column(ForeignKey("colleges.id"))
    campus_id: Mapped[UUID | None] = mapped_column(ForeignKey("campuses.id"))
    action: Mapped[str] = mapped_column(String(24))
    reason: Mapped[str] = mapped_column(String(1000))
    before: Mapped[dict] = mapped_column(JSON)
    after: Mapped[dict] = mapped_column(JSON)
