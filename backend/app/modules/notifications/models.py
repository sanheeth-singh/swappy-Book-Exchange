from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class Notification(IdentityMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("recipient_id", "event_key", name="uq_notifications_recipient_event"),
        CheckConstraint(
            "resource_type IN ('EXCHANGE','MEMBERSHIP','REPORT','LISTING','ACCOUNT')",
            name="resource_type",
        ),
        Index("ix_notifications_inbox", "recipient_id", "created_at", "id"),
        Index("ix_notifications_unread", "recipient_id", postgresql_where=text("read_at IS NULL")),
    )
    recipient_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(40))
    resource_type: Mapped[str] = mapped_column(String(20))
    resource_id: Mapped[UUID] = mapped_column()
    event_key: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
