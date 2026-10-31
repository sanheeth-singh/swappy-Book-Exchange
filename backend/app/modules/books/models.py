from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    false,
    select,
    text,
)
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

from app.db.base import Base, IdentityMixin
from app.modules.books.genres import Genre
from app.modules.exchanges.models import Reservation


class PhysicalBook(IdentityMixin, Base):
    __tablename__ = "physical_books"
    __table_args__ = (
        CheckConstraint(
            "genre IS NULL OR genre IN (" + ",".join(repr(g.value) for g in Genre) + ")",
            name="genre",
        ),
    )
    genre: Mapped[str | None] = mapped_column(String(32))
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(200))


class BookListing(IdentityMixin, Base):
    __tablename__ = "book_listings"
    genre: Mapped[str | None] = mapped_column(String(32))
    allow_public_preview: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    __table_args__ = (
        CheckConstraint(
            "genre IS NULL OR genre IN (" + ",".join(repr(g.value) for g in Genre) + ")",
            name="genre",
        ),
        Index(
            "ix_book_listings_recommendation",
            "campus_id",
            "genre",
            "created_at",
            "id",
            postgresql_where=text("NOT is_archived AND NOT is_hidden"),
        ),
        Index(
            "ix_book_listings_public_preview",
            "created_at",
            "id",
            postgresql_where=text("allow_public_preview AND NOT is_archived AND NOT is_hidden"),
        ),
        Index("ix_book_listings_owner_history", "owner_id", "physical_book_id", "created_at", "id"),
        Index(
            "uq_book_listings_live_physical_book",
            "physical_book_id",
            unique=True,
            postgresql_where=text("NOT is_archived"),
        ),
        CheckConstraint("condition IN ('NEW','LIKE_NEW','GOOD','FAIR','POOR')", name="condition"),
    )
    physical_book_id: Mapped[UUID] = mapped_column(ForeignKey("physical_books.id"))
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    campus_id: Mapped[UUID] = mapped_column(ForeignKey("campuses.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(2000))
    condition: Mapped[str] = mapped_column(String(20))
    condition_notes: Mapped[str] = mapped_column(String(1000), default="")
    photos: Mapped[list["BookPhoto"]] = relationship(lazy="raise", order_by="BookPhoto.created_at")
    is_reserved: Mapped[bool] = column_property(
        select(Reservation.physical_book_id)
        .where(Reservation.physical_book_id == physical_book_id)
        .correlate_except(Reservation)
        .exists()
    )
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class BookPhoto(IdentityMixin, Base):
    __tablename__ = "book_photos"
    book_id: Mapped[UUID] = mapped_column(ForeignKey("book_listings.id"), index=True)
    file_id: Mapped[str] = mapped_column(String(255), unique=True)
    url: Mapped[str] = mapped_column(String(2000))


class PhotoDeletionTask(IdentityMixin, Base):
    __tablename__ = "photo_deletion_tasks"
    file_id: Mapped[str] = mapped_column(String(255), unique=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
