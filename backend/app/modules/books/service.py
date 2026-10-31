from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.books.models import BookListing, BookPhoto, PhotoDeletionTask, PhysicalBook
from app.modules.books.queries import listings
from app.modules.books.schemas import BookCreate, BookInput
from app.modules.books.storage import ImageStorage
from app.modules.colleges.directory import directory_lock, require_active_campus
from app.modules.colleges.models import Membership
from app.modules.colleges.policies import require_browsing, require_participation
from app.modules.exchanges.models import Reservation
from app.modules.exchanges.queries import reject_pending
from app.modules.moderation.policies import require_publication_allowed
from app.modules.users.models import User


async def lock_actor(session: AsyncSession, actor: User, *, verified: bool = True) -> User:
    await directory_lock(session)
    # Same lock order as membership review and profile updates.
    user = await session.scalar(
        select(User)
        .where(User.id == actor.id)
        .with_for_update(key_share=True)
        .execution_options(populate_existing=True)
    )
    if not user.is_active:
        raise DomainError("account_inactive", "Account is inactive.")
    require_browsing(name=user.display_name, campus_id=user.campus_id)
    await require_active_campus(session, user.campus_id)
    if verified:
        require_publication_allowed(user.is_participation_restricted)
        membership = await session.scalar(
            select(Membership)
            .where(Membership.user_id == user.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if membership is None:
            raise DomainError("membership_required", "Campus verification is required.")
        require_participation(
            status=membership.status,
            active=membership.active,
            campus_id=membership.campus_id,
            selected_campus_id=user.campus_id,
            expires_at=membership.expires_at,
        )
    return user


async def owned_listing(session: AsyncSession, actor: User, book_id: UUID) -> BookListing:
    book = await session.scalar(
        listings()
        .where(BookListing.id == book_id, BookListing.owner_id == actor.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if book is None:
        raise DomainError("book_not_found", "Book not found.", 404)
    return book


def require_editable(book: BookListing, actor: User) -> None:
    if book.is_hidden:
        raise DomainError("listing_hidden", "This listing requires administrator review.", 409)
    if book.is_archived or book.campus_id != actor.campus_id:
        raise DomainError(
            "book_not_editable", "Archive this listing and create one in your campus.", 409
        )


async def create_book(session: AsyncSession, user: User, data: BookCreate) -> BookListing:
    actor = await lock_actor(session, user)
    if data.physical_book_id:
        physical = await session.scalar(
            select(PhysicalBook)
            .where(PhysicalBook.id == data.physical_book_id, PhysicalBook.owner_id == actor.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if physical is None:
            raise DomainError("book_not_owned", "Physical book not found in your collection.", 404)
        hidden = await session.scalar(
            select(BookListing.id)
            .where(
                BookListing.physical_book_id == physical.id,
                BookListing.owner_id == actor.id,
                BookListing.is_hidden.is_(True),
            )
            .limit(1)
        )
        if hidden:
            raise DomainError("listing_hidden", "This copy requires administrator review.", 409)
        existing = await session.scalar(
            select(BookListing.id)
            .where(BookListing.physical_book_id == physical.id, BookListing.is_archived.is_(False))
            .limit(1)
        )
        if existing or await session.get(Reservation, physical.id):
            raise DomainError("book_already_listed", "Book is listed or reserved.", 409)
    else:
        physical = PhysicalBook(
            owner_id=actor.id, title=data.title, author=data.author, genre=data.genre
        )
        session.add(physical)
        await session.flush()
    physical.title, physical.author, physical.genre = data.title, data.author, data.genre
    listing = BookListing(
        owner_id=actor.id,
        campus_id=actor.campus_id,
        physical_book_id=physical.id,
        **data.model_dump(exclude={"physical_book_id"}),
    )
    listing.photos = []
    session.add(listing)
    await session.commit()
    await session.refresh(listing, attribute_names=["is_reserved"])
    return listing


async def edit_book(
    session: AsyncSession, user: User, book_id: UUID, data: BookInput
) -> BookListing:
    actor = await lock_actor(session, user)
    listing = await owned_listing(session, actor, book_id)
    require_editable(listing, actor)
    await require_unreserved(session, listing)
    await reject_pending(session, [listing.id])
    for key, value in data.model_dump().items():
        setattr(listing, key, value)
    physical = await session.scalar(
        select(PhysicalBook)
        .where(PhysicalBook.id == listing.physical_book_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    physical.title, physical.author, physical.genre = data.title, data.author, data.genre
    await session.commit()
    # SQL expression properties expire on flush; load before serialization.
    await session.refresh(listing, attribute_names=["is_reserved"])
    return listing


async def archive_book(session: AsyncSession, user: User, book_id: UUID) -> BookListing:
    # Withdrawal remains possible after verification expires.
    actor = await lock_actor(session, user, verified=False)
    listing = await owned_listing(session, actor, book_id)
    if not listing.is_archived:
        await require_unreserved(session, listing)
        await reject_pending(session, [listing.id])
        listing.is_archived = True
    await session.commit()
    # SQL expression properties expire on flush; load before serialization.
    await session.refresh(listing, attribute_names=["is_reserved"])
    return listing


async def attach_photo(
    session: AsyncSession, user: User, book_id: UUID, data: bytes, storage: ImageStorage
) -> BookPhoto:
    actor = await lock_actor(session, user)
    listing = await owned_listing(session, actor, book_id)
    require_editable(listing, actor)
    await require_unreserved(session, listing)
    if len(listing.photos) >= 3:
        raise DomainError("photo_limit", "A listing can have up to three photos.", 409)
    file_id, url = await storage.upload(data, listing.id)
    record = BookPhoto(book_id=listing.id, file_id=file_id, url=url)
    session.add(record)
    try:
        await reject_pending(session, [listing.id])
        await session.commit()
    except Exception:
        await session.rollback()
        await storage.cleanup(file_id)
        raise
    return record


async def require_unreserved(session: AsyncSession, listing: BookListing) -> None:
    if await session.get(Reservation, listing.physical_book_id):
        raise DomainError(
            "book_reserved", "Resolve the exchange before changing this listing.", 409
        )


async def remove_photo(
    session: AsyncSession, user: User, book_id: UUID, photo_id: UUID, storage: ImageStorage
) -> None:
    actor = await lock_actor(session, user)
    listing = await owned_listing(session, actor, book_id)
    require_editable(listing, actor)
    await require_unreserved(session, listing)
    photo = await session.scalar(
        select(BookPhoto)
        .where(BookPhoto.id == photo_id, BookPhoto.book_id == listing.id)
        .with_for_update()
    )
    if photo is None:
        raise DomainError("photo_not_found", "Photo not found in this listing.", 404)
    task = PhotoDeletionTask(file_id=photo.file_id)
    session.add(task)
    await session.delete(photo)
    await reject_pending(session, [listing.id])
    await session.commit()
    # The persistent queue survives process/storage failure. Normal cleanup is immediate.
    from app.modules.books.photo_cleanup import process_task

    try:
        await process_task(session, task.id, storage)
    except Exception:
        await session.rollback()
        import logging

        logging.getLogger(__name__).exception("Photo removed; persistent cleanup will retry")
