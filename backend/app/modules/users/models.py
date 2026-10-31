from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, String, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdentityMixin
from app.modules.users.avatars import AVATAR_IDS, DEFAULT_AVATAR


class User(IdentityMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = lower(email)", name="email_lowercase"),
        CheckConstraint(
            "avatar_id IN (" + ",".join(repr(value) for value in AVATAR_IDS) + ")", name="avatar_id"
        ),
        CheckConstraint(
            "json_typeof(reading_interests) = 'array' "
            "AND json_array_length(reading_interests) <= 8",
            name="reading_interests",
        ),
    )
    email: Mapped[str] = mapped_column(String(254), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(80))
    campus_id: Mapped[UUID | None] = mapped_column(ForeignKey("campuses.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_participation_restricted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    avatar_id: Mapped[str] = mapped_column(
        String(32), default=DEFAULT_AVATAR, server_default=DEFAULT_AVATAR
    )
    bio: Mapped[str | None] = mapped_column(String(300))
    reading_interests: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default=text("'[]'")
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
