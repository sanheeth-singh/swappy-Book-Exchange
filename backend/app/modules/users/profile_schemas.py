from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.books.schemas import BookResponse
from app.modules.users.avatars import AVATAR_IDS


class PublicDetailsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=300)
    reading_interests: list[Annotated[str, Field(min_length=1, max_length=40)]] | None = Field(
        default=None, max_length=8
    )
    avatar_id: str | None = None

    @field_validator("display_name", "avatar_id", "reading_interests", mode="before")
    @classmethod
    def nonnull(cls, value):
        if value is None:
            raise ValueError("Omit unchanged fields; this field cannot be null.")
        return value

    @field_validator("display_name")
    @classmethod
    def plain_name(cls, value):
        if any(ord(c) < 32 for c in value):
            raise ValueError("Use a name without control characters.")
        return value

    @field_validator("avatar_id")
    @classmethod
    def known_avatar(cls, value):
        if value not in AVATAR_IDS:
            raise ValueError("Choose an avatar from the catalog.")
        return value

    @field_validator("bio")
    @classmethod
    def clean_bio(cls, value):
        if value is not None and any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Use plain text without control characters.")
        return value or None

    @field_validator("reading_interests", mode="before")
    @classmethod
    def clean_interests(cls, value):
        if not isinstance(value, list) or len(value) > 8:
            raise ValueError("Choose up to eight reading interests.")
        result, seen = [], set()
        for item in value:
            if not isinstance(item, str) or any(ord(c) < 32 for c in item):
                raise ValueError("Interests must be plain-text strings.")
            item = item.strip()
            if item.casefold() not in seen:
                result.append(item)
                seen.add(item.casefold())
        return result

    @model_validator(mode="after")
    def has_changes(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one profile field.")
        return self


class AvatarResponse(BaseModel):
    id: str
    name: str
    url: str


class CampusSummary(BaseModel):
    is_active: bool
    id: UUID
    name: str
    college_name: str
    city: str


class ProfileMetrics(BaseModel):
    active_listings: int
    completed_exchanges: int
    distinct_exchange_partners: int
    review_count: int
    average_rating: float | None
    distinct_reviewers: int
    trust_score: float | None
    trust_status: Literal["NOT_ENOUGH_HISTORY", "AVAILABLE"]
    trust_version: str
    minimum_distinct_reviewers: int


class PublicProfile(BaseModel):
    id: UUID
    display_name: str | None
    avatar_id: str
    avatar_url: str
    bio: str | None
    reading_interests: list[str]
    campus: CampusSummary | None
    membership_verified: bool
    is_self: bool
    metrics: ProfileMetrics


class ProfileBooks(BaseModel):
    items: list[BookResponse]
    next_cursor: UUID | None


class PasswordChangeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=4, max_length=128)


class DeactivationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)


class DeactivationEligibility(BaseModel):
    can_deactivate: bool
    pending: int
    accepted: int
    waiting_confirmation: int


class DeactivationResponse(BaseModel):
    deactivated_at: datetime
