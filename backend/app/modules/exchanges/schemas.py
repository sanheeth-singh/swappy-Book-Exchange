from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.books.schemas import BookResponse


class ProposalInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requested_listing_id: UUID
    offered_listing_id: UUID

    @model_validator(mode="after")
    def different_books(self):
        if self.requested_listing_id == self.offered_listing_id:
            raise ValueError("Choose two different listings.")
        return self


class ExchangeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    requester_id: UUID
    owner_id: UUID
    requester_name: str
    owner_name: str
    campus_id: UUID
    requested_listing_id: UUID
    offered_listing_id: UUID
    requested_snapshot: BookResponse
    offered_snapshot: BookResponse
    status: Literal[
        "PENDING",
        "ACCEPTED",
        "WAITING_CONFIRMATION",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
    ]
    requester_confirmed: bool
    owner_confirmed: bool
    accepted_at: datetime | None
    expires_at: datetime | None
    completed_at: datetime | None
    resolution_reason: str | None
    resolved_by: UUID | None
    resolved_at: datetime | None


class IssueInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    explanation: str = Field(min_length=10, max_length=2000)


class IssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exchange_id: UUID
    reported_by: UUID
    explanation: str
    status: Literal["OPEN", "RESOLVED"]
    created_at: datetime


class ResolutionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    decision: Literal["COMPLETE", "CANCEL"]
    reason: str = Field(min_length=10, max_length=1000)
