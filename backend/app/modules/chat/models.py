from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class ChatMessage(IdentityMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        UniqueConstraint("exchange_id", "sequence", name="uq_chat_exchange_sequence"),
        UniqueConstraint(
            "exchange_id", "sender_id", "client_message_id", name="uq_chat_sender_retry"
        ),
        CheckConstraint("sequence > 0", name="positive_sequence"),
        CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="body_length"),
    )
    exchange_id: Mapped[UUID] = mapped_column(ForeignKey("exchanges.id"))
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    client_message_id: Mapped[UUID]
    sequence: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)


class ChatReadPosition(Base):
    __tablename__ = "chat_read_positions"
    __table_args__ = (CheckConstraint("sequence > 0", name="positive_sequence"),)
    exchange_id: Mapped[UUID] = mapped_column(ForeignKey("exchanges.id"), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
