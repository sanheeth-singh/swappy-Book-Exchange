from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies.database import Session
from app.modules.books import preview
from app.modules.books.genres import Genre
from app.modules.books.preview_schemas import PublicPreviewResponse

router = APIRouter(prefix="/public/books", tags=["visitor book preview"])


@router.get("", response_model=PublicPreviewResponse)
async def books(
    session: Session,
    limit: Annotated[int, Query(ge=1, le=preview.PAGE_LIMIT)] = 20,
    offset: Annotated[int, Query(ge=0, le=100)] = 0,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    genre: Genre | None = None,
):
    return await preview.browse(session, limit, offset, q, genre)
