from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import or_, select
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.api.dependencies.membership import CampusBrowser
from app.core.errors import DomainError
from app.modules.books import preview, recommendations, service
from app.modules.books.genres import GENRE_LABELS, Genre
from app.modules.books.images import MAX_IMAGE_BYTES, normalize_image
from app.modules.books.models import BookListing, PhysicalBook
from app.modules.books.preview_schemas import PreviewPermissionInput
from app.modules.books.queries import discoverable_listings, listings
from app.modules.books.schemas import (
    BookCreate,
    BookInput,
    BookResponse,
    GenreResponse,
    PhotoResponse,
    PhysicalBookResponse,
    RecommendationResponse,
)
from app.modules.books.storage import ImageStorage, get_image_storage

router = APIRouter(prefix="/books", tags=["books"])
Storage = Annotated[ImageStorage, Depends(get_image_storage)]


@router.get("", response_model=list[BookResponse])
async def books(
    user: CampusBrowser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    genre: Genre | None = None,
):
    query = discoverable_listings(user.id).where(
        BookListing.campus_id == user.campus_id, BookListing.owner_id != user.id
    )
    if genre is not None:
        query = query.where(BookListing.genre == genre)
    if q:
        query = query.where(
            or_(
                BookListing.title.icontains(q.strip(), autoescape=True),
                BookListing.author.icontains(q.strip(), autoescape=True),
            )
        )
    return (
        await session.scalars(
            query.order_by(BookListing.created_at.desc(), BookListing.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/genres", response_model=list[GenreResponse])
async def genres(actor: CurrentUser):
    return [GenreResponse(id=genre, name=name) for genre, name in GENRE_LABELS.items()]


@router.get("/recommendations", response_model=RecommendationResponse)
async def recommended_books(user: CampusBrowser, session: Session):
    return await recommendations.recommend(session, user)


@router.get("/me", response_model=list[BookResponse])
async def my_books(
    user: CampusBrowser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return (
        await session.scalars(
            listings()
            .where(BookListing.owner_id == user.id)
            .order_by(BookListing.created_at.desc(), BookListing.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/collection", response_model=list[PhysicalBookResponse])
async def collection(
    user: CampusBrowser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return (
        await session.scalars(
            select(PhysicalBook)
            .where(PhysicalBook.owner_id == user.id)
            .order_by(PhysicalBook.created_at.desc(), PhysicalBook.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(data: BookCreate, user: CampusBrowser, session: Session):
    return await service.create_book(session, user, data)


@router.put("/{book_id}", response_model=BookResponse)
async def edit_book(book_id: UUID, data: BookInput, user: CampusBrowser, session: Session):
    return await service.edit_book(session, user, book_id, data)


@router.post("/{book_id}/archive", response_model=BookResponse)
async def archive_book(book_id: UUID, user: CampusBrowser, session: Session):
    return await service.archive_book(session, user, book_id)


@router.patch("/{book_id}/public-preview", response_model=BookResponse)
async def set_public_preview(
    book_id: UUID, data: PreviewPermissionInput, user: CurrentUser, session: Session
):
    return await preview.set_permission(session, user, book_id, data.allow_public_preview)


@router.post("/{book_id}/photos", response_model=PhotoResponse, status_code=201)
async def upload_photo(
    book_id: UUID,
    user: CampusBrowser,
    session: Session,
    storage: Storage,
    photo: Annotated[UploadFile, File()],
):
    try:
        data = await photo.read(MAX_IMAGE_BYTES + 1)
    finally:
        await photo.close()
    data = await run_in_threadpool(normalize_image, data)
    return await service.attach_photo(session, user, book_id, data, storage)


@router.get("/{book_id}", response_model=BookResponse)
async def book(book_id: UUID, user: CampusBrowser, session: Session):
    listing = await session.scalar(
        discoverable_listings(user.id).where(
            BookListing.id == book_id,
            BookListing.campus_id == user.campus_id,
            BookListing.is_archived.is_(False),
        )
    )
    if listing is None:
        raise DomainError("book_not_found", "Book not found.", 404)
    return listing


@router.delete("/{book_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    book_id: UUID, photo_id: UUID, user: CampusBrowser, session: Session, storage: Storage
):
    await service.remove_photo(session, user, book_id, photo_id, storage)
