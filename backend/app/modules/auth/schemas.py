from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    csrf_token: str
    session_id: UUID
    refresh_expires_at: datetime


class CsrfResponse(BaseModel):
    csrf_token: str
    session_id: UUID


class SessionResponse(BaseModel):
    id: UUID
    created_at: datetime
    expires_at: datetime
    last_refreshed_at: datetime
    user_agent: str
    is_current: bool
