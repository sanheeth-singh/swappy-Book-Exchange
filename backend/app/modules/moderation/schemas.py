from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

TargetType = Literal["USER", "LISTING"]
ReportStatus = Literal["OPEN", "RESOLVED", "DISMISSED"]
ReportAction = Literal["DISMISS", "RESOLVE", "HIDE_LISTING", "RESTRICT_USER"]


class ReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    target_type: TargetType
    target_user_id: UUID | None = None
    listing_id: UUID | None = None
    reason: Literal["SPAM", "HARASSMENT", "INAPPROPRIATE_CONTENT", "MISLEADING_LISTING", "OTHER"]
    details: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def valid_target(self):
        if self.target_type == "USER":
            valid = self.target_user_id is not None and self.listing_id is None
        else:
            valid = self.listing_id is not None and self.target_user_id is None
        if not valid:
            raise ValueError("Provide only the ID corresponding to target_type.")
        if self.reason == "OTHER" and len(self.details) < 10:
            raise ValueError("Explain OTHER reports in at least 10 characters.")
        return self


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    target_type: TargetType
    target_user_id: UUID
    listing_id: UUID | None
    reason: str
    details: str
    status: ReportStatus
    created_at: datetime
    action: ReportAction | None
    reviewed_at: datetime | None
    review_summary: str | None


class AdminReportResponse(ReportResponse):
    reporter_id: UUID
    reviewed_by: UUID | None
    target_snapshot: dict[str, JsonValue]


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    action: ReportAction
    summary: str = Field(min_length=10, max_length=1000)


class RestoreInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=10, max_length=1000)


class RestoreResponse(BaseModel):
    target_type: TargetType
    target_id: UUID
    changed: bool


class BlockResponse(BaseModel):
    blocked_user_id: UUID
    blocked: bool


class BlockListItem(BaseModel):
    blocked_user_id: UUID
    created_at: datetime


class ActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_id: UUID
    target_user_id: UUID
    listing_id: UUID | None
    report_id: UUID | None
    action: str
    note: str
    created_at: datetime
