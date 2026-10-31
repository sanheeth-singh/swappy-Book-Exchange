from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=10, max_length=1000)

    @field_validator("reason")
    @classmethod
    def plain_reason(cls, value):
        if any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Use plain text without control characters.")
        return value


def clean_label(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Use a text label.")
    if any(ord(c) < 32 for c in value):
        raise ValueError("Directory labels cannot contain control characters.")
    return " ".join(value.split())


class CollegeCreate(Input):
    name: str = Field(min_length=1, max_length=200)
    _name = field_validator("name", mode="before")(clean_label)


class CollegeEdit(CollegeCreate):
    pass


class CampusCreate(Input):
    college_id: UUID
    name: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=120)
    _labels = field_validator("name", "city", mode="before")(clean_label)


class CampusEdit(Input):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("name", "city", mode="before")
    @classmethod
    def labels(cls, value):
        if value is None:
            raise ValueError("Omit unchanged labels rather than using null.")
        return clean_label(value)

    @model_validator(mode="after")
    def changed_fields(self):
        if not ({"name", "city"} & self.model_fields_set):
            raise ValueError("Provide a name or city to update.")
        return self


class AvailabilityInput(Input):
    # Keep password whitespace intact; do not inherit the label-stripping setting for secrets.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    is_active: bool = Field(strict=True)
    current_password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value):
        return value.strip() if isinstance(value, str) else value


class CollegeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    is_active: bool


class AdminCampusResponse(BaseModel):
    id: UUID
    college_id: UUID
    college_name: str
    name: str
    city: str
    is_active: bool
    college_is_active: bool
    effective_is_active: bool


class DirectoryActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_id: UUID | None
    source: str
    college_id: UUID
    campus_id: UUID | None
    action: str
    reason: str
    before: dict
    after: dict
    created_at: datetime


class DirectoryImpact(BaseModel):
    college_id: UUID
    campus_id: UUID | None
    campus_count: int
    selected_users: int
    live_listings: int
    pending_exchanges: int
    accepted_exchanges: int
    waiting_confirmation_exchanges: int
