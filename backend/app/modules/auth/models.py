from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin


class LoginSession(IdentityMixin, Base):
    __tablename__ = "login_sessions"
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="positive_lifetime"),
        Index("ix_login_sessions_user_id", "user_id"),
        Index("ix_login_sessions_expires_at", "expires_at"),
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str] = mapped_column(String(255), default="")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revocation_reason: Mapped[str | None] = mapped_column(String(32))


class RefreshCredential(IdentityMixin, Base):
    __tablename__ = "refresh_credentials"
    __table_args__ = (
        Index(
            "uq_refresh_credentials_current_session",
            "session_id",
            unique=True,
            postgresql_where=text("consumed_at IS NULL"),
        ),
        Index("ix_refresh_credentials_session_id", "session_id"),
    )
    session_id: Mapped[UUID] = mapped_column(ForeignKey("login_sessions.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
