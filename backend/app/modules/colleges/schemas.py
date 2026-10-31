from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CampusResponse(BaseModel):
    college_name: str = ""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    college_id: UUID
    name: str
    city: str


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    campus_id: UUID
    status: str
    active: bool
    submission_id: UUID | None
    expires_at: datetime | None
    review_reason: str | None


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    decision: Literal["VERIFIED", "REJECTED"]
    reason: str | None = Field(default=None, min_length=1, max_length=500)
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def review_requirements(self):
        if self.decision == "REJECTED" and not self.reason:
            raise ValueError("A rejection reason is required")
        if self.decision == "VERIFIED" and (
            self.expires_at is None or self.expires_at.tzinfo is None
        ):
            raise ValueError("Approval requires a timezone-aware enrollment expiration")
        return self


class ReviewQueueResponse(MembershipResponse):
    user_id: UUID
    display_name: str
