from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.notifications.events import NotificationKind, ResourceType


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    kind: NotificationKind
    resource_type: ResourceType
    resource_id: UUID
    title: str
    body: str
    created_at: datetime
    read_at: datetime | None


class NotificationPage(BaseModel):
    items: list[NotificationResponse]
    next_cursor: UUID | None
    unread_count: int


class UnreadCount(BaseModel):
    unread_count: int


class ReadAllInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    through_id: UUID


class ReadAllResponse(BaseModel):
    updated_count: int
