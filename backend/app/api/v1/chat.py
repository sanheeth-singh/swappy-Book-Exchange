from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.modules.chat import service
from app.modules.chat.schemas import (
    ChatPage,
    MessageInput,
    MessageResponse,
    ReadInput,
    ReadPosition,
)

router = APIRouter(prefix="/exchanges/{exchange_id}/chat", tags=["exchange chat"])


@router.get("/messages", response_model=ChatPage)
async def history(
    exchange_id: UUID,
    actor: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    before: Annotated[int | None, Query(ge=1)] = None,
):
    return await service.history(session, actor, exchange_id, limit, before)


@router.post("/messages", response_model=MessageResponse, status_code=200)
async def send(exchange_id: UUID, data: MessageInput, actor: CurrentUser, session: Session):
    return await service.send(session, actor, exchange_id, data)


@router.post("/read", response_model=ReadPosition)
async def read(exchange_id: UUID, data: ReadInput, actor: CurrentUser, session: Session):
    return await service.mark_read(session, actor, exchange_id, data.through_message_id)
