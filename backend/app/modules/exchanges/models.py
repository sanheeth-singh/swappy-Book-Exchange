from datetime import datetime
from uuid import UUID

from pydantic import JsonValue
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class Exchange(IdentityMixin, Base):
    __tablename__ = "exchanges"
    __table_args__ = (
        CheckConstraint("requester_id <> owner_id", name="different_participants"),
        CheckConstraint("requested_listing_id <> offered_listing_id", name="different_listings"),
        CheckConstraint(
            "status IN ('PENDING','ACCEPTED','WAITING_CONFIRMATION',"
            "'COMPLETED','REJECTED','CANCELLED','EXPIRED')",
            name="status",
        ),
        CheckConstraint(
            "(status = 'PENDING' AND accepted_at IS NULL AND expires_at IS NULL "
            "AND NOT requester_confirmed AND NOT owner_confirmed) OR "
            "(status = 'ACCEPTED' AND accepted_at IS NOT NULL AND expires_at IS NOT NULL "
            "AND NOT requester_confirmed AND NOT owner_confirmed) OR "
            "(status = 'WAITING_CONFIRMATION' AND accepted_at IS NOT NULL "
            "AND expires_at IS NOT NULL AND requester_confirmed <> owner_confirmed) OR "
            "(status = 'COMPLETED' AND requester_confirmed AND owner_confirmed "
            "AND completed_at IS NOT NULL) OR "
            "(status IN ('REJECTED','CANCELLED','EXPIRED'))",
            name="state_consistency",
        ),
        Index(
            "uq_exchanges_active_pair",
            text("LEAST(requested_listing_id, offered_listing_id)"),
            text("GREATEST(requested_listing_id, offered_listing_id)"),
            unique=True,
            postgresql_where=text("status IN ('PENDING','ACCEPTED','WAITING_CONFIRMATION')"),
        ),
    )
    requester_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    campus_id: Mapped[UUID] = mapped_column(ForeignKey("campuses.id"))
    requested_listing_id: Mapped[UUID] = mapped_column(ForeignKey("book_listings.id"))
    offered_listing_id: Mapped[UUID] = mapped_column(ForeignKey("book_listings.id"))
    requested_snapshot: Mapped[dict[str, JsonValue]] = mapped_column(JSON)
    offered_snapshot: Mapped[dict[str, JsonValue]] = mapped_column(JSON)
    requester_name: Mapped[str] = mapped_column(String(80))
    owner_name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(24), default="PENDING")
    requester_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_reason: Mapped[str | None] = mapped_column(String(1000))
    resolved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Reservation(Base):
    __tablename__ = "book_reservations"
    # One physical book can belong to at most one accepted/waiting exchange.
    physical_book_id: Mapped[UUID] = mapped_column(
        ForeignKey("physical_books.id"), primary_key=True
    )
    exchange_id: Mapped[UUID] = mapped_column(ForeignKey("exchanges.id"), index=True)


class ExchangeIssue(IdentityMixin, Base):
    __tablename__ = "exchange_issues"
    exchange_id: Mapped[UUID] = mapped_column(ForeignKey("exchanges.id"), index=True)
    reported_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    explanation: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="OPEN")
    __table_args__ = (
        CheckConstraint("status IN ('OPEN','RESOLVED')", name="status"),
        Index(
            "uq_exchange_issues_open_reporter",
            "exchange_id",
            "reported_by",
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
        ),
    )
