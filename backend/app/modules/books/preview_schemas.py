from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.books.genres import Genre
from app.modules.books.schemas import Condition, GenreResponse


class PreviewPermissionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allow_public_preview: bool = Field(strict=True)


class PublicBookCard(BaseModel):
    # Explicit allowlist; never inherit BookResponse or serialize ORM objects directly.
    id: UUID
    title: str
    author: str
    genre: Genre | None
    condition: Condition
    cover_url: str | None


class PublicPreviewResponse(BaseModel):
    items: list[PublicBookCard] = Field(max_length=20)
    total: int = Field(ge=0, le=100)
    next_offset: int | None
    preview_limit: Literal[100] = 100
    genres: list[GenreResponse]
    registration_message: Literal["Register to explore books in your selected campus."] = (
        "Register to explore books in your selected campus."
    )
