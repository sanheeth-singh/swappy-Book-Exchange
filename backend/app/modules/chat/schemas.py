from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_message_id: UUID
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        value = value.strip()
        if not value or any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Use nonempty text without control characters.")
        return value


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    exchange_id: UUID
    sender_id: UUID
    client_message_id: UUID
    sequence: int
    body: str
    created_at: datetime


class ReadInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    through_message_id: UUID


class ReadPosition(BaseModel):
    sequence: int = 0
    read_at: datetime | None = None


class ChatPage(BaseModel):
    items: list[MessageResponse]
    next_before: int | None
    unread_count: int
    my_read: ReadPosition
    other_read: ReadPosition
    can_send: bool
    unavailable_code: str | None = None
