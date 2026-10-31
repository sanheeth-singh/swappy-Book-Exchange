from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.modules.notifications import service
from app.modules.notifications.schemas import (
    NotificationPage,
    NotificationResponse,
    ReadAllInput,
    ReadAllResponse,
    UnreadCount,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage)
async def inbox(
    actor: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before: UUID | None = None,
    unread_only: bool = False,
):
    rows, cursor = await service.inbox(session, actor.id, limit, before, unread_only)
    return NotificationPage(
        items=[NotificationResponse.model_validate(row) for row in rows],
        next_cursor=cursor,
        unread_count=await service.unread_count(session, actor.id),
    )


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(actor: CurrentUser, session: Session):
    return UnreadCount(unread_count=await service.unread_count(session, actor.id))


@router.post("/read-all", response_model=ReadAllResponse)
async def mark_all(data: ReadAllInput, actor: CurrentUser, session: Session):
    return ReadAllResponse(
        updated_count=await service.mark_all_read(session, actor.id, data.through_id)
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: UUID, actor: CurrentUser, session: Session):
    return await service.mark_read(session, actor.id, notification_id)
