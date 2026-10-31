from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.modules.moderation.models import UserBlock
from app.modules.moderation.schemas import BlockListItem, BlockResponse
from app.modules.moderation.service import set_block

router = APIRouter(prefix="/blocks", tags=["blocking"])


@router.get("", response_model=list[BlockListItem])
async def my_blocks(
    actor: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    rows = (
        await session.scalars(
            select(UserBlock)
            .where(
                UserBlock.blocker_id == actor.id,
            )
            .order_by(UserBlock.created_at.desc(), UserBlock.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return [
        BlockListItem(blocked_user_id=row.blocked_id, created_at=row.created_at) for row in rows
    ]


@router.post("/{user_id}", response_model=BlockResponse)
async def block(user_id: UUID, actor: CurrentUser, session: Session):
    await set_block(session, actor, user_id, blocked=True)
    return BlockResponse(blocked_user_id=user_id, blocked=True)


@router.post("/{user_id}/unblock", response_model=BlockResponse)
async def unblock(user_id: UUID, actor: CurrentUser, session: Session):
    await set_block(session, actor, user_id, blocked=False)
    return BlockResponse(blocked_user_id=user_id, blocked=False)
