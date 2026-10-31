from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.books.genres import Genre

Condition = Literal["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]


class BookInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    condition: Condition
    genre: Genre
    condition_notes: str = Field(default="", max_length=1000)


class BookCreate(BookInput):
    allow_public_preview: bool = Field(default=False, strict=True)
    physical_book_id: UUID | None = None


class PhysicalBookResponse(BaseModel):
    genre: Genre | None = None
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_id: UUID
    title: str
    author: str


class PhotoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    url: str


class BookResponse(BookInput):
    allow_public_preview: bool = False
    # Legacy rows/snapshots may have no classification; new create/edit inputs require it.
    genre: Genre | None = None
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    physical_book_id: UUID
    owner_id: UUID
    campus_id: UUID
    is_hidden: bool = False
    is_archived: bool
    is_reserved: bool
    photos: list[PhotoResponse]


class GenreResponse(BaseModel):
    id: Genre
    name: str


class RecommendationItem(BaseModel):
    book: BookResponse
    reason: Literal["GENRE_MATCH", "RECENT_AVAILABLE"]


class RecommendationResponse(BaseModel):
    items: list[RecommendationItem] = Field(max_length=5)
    preferred_genres: list[Genre]
    preference_sources: list[Literal["LISTING_HISTORY", "READING_INTERESTS"]]
    strategy: Literal["genre-recency-v1"] = "genre-recency-v1"
