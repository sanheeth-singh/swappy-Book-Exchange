from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api.dependencies.authentication import AdminUser, CurrentUser
from app.api.dependencies.database import Session
from app.core.errors import DomainError
from app.modules.exchanges import service
from app.modules.exchanges.models import Exchange, ExchangeIssue
from app.modules.exchanges.schemas import (
    ExchangeResponse,
    IssueInput,
    IssueResponse,
    ProposalInput,
    ResolutionInput,
)

router = APIRouter(prefix="/exchanges", tags=["exchanges"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post("", response_model=ExchangeResponse, status_code=201)
async def propose(data: ProposalInput, actor: CurrentUser, session: Session):
    return await service.propose(session, actor, data)


@router.get("/sent", response_model=list[ExchangeResponse])
async def sent(actor: CurrentUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(Exchange)
            .where(Exchange.requester_id == actor.id)
            .order_by(Exchange.created_at.desc(), Exchange.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/received", response_model=list[ExchangeResponse])
async def received(actor: CurrentUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(Exchange)
            .where(Exchange.owner_id == actor.id)
            .order_by(Exchange.created_at.desc(), Exchange.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/admin/issues", response_model=list[IssueResponse])
async def open_issues(actor: AdminUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(ExchangeIssue)
            .where(ExchangeIssue.status == "OPEN")
            .order_by(ExchangeIssue.created_at, ExchangeIssue.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/admin/{exchange_id}", response_model=ExchangeResponse)
async def admin_detail(exchange_id: UUID, actor: AdminUser, session: Session):
    exchange = await session.get(Exchange, exchange_id)
    if exchange is None:
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    return exchange


@router.post("/{exchange_id}/accept", response_model=ExchangeResponse)
async def accept(exchange_id: UUID, actor: CurrentUser, session: Session):
    return await service.act(session, actor, exchange_id, "accept")


@router.post("/{exchange_id}/reject", response_model=ExchangeResponse)
async def reject(exchange_id: UUID, actor: CurrentUser, session: Session):
    return await service.act(session, actor, exchange_id, "reject")


@router.post("/{exchange_id}/cancel", response_model=ExchangeResponse)
async def cancel(exchange_id: UUID, actor: CurrentUser, session: Session):
    return await service.act(session, actor, exchange_id, "cancel")


@router.post("/{exchange_id}/confirm", response_model=ExchangeResponse)
async def confirm(exchange_id: UUID, actor: CurrentUser, session: Session):
    return await service.act(session, actor, exchange_id, "confirm")


@router.post("/{exchange_id}/issues", response_model=IssueResponse, status_code=201)
async def issue(exchange_id: UUID, data: IssueInput, actor: CurrentUser, session: Session):
    return await service.report_issue(session, actor, exchange_id, data.explanation)


@router.get("/{exchange_id}/issues", response_model=list[IssueResponse])
async def exchange_issues(
    exchange_id: UUID,
    actor: CurrentUser,
    session: Session,
    limit: Limit = 20,
    offset: Offset = 0,
):
    await detail(exchange_id, actor, session)
    return (
        await session.scalars(
            select(ExchangeIssue)
            .where(ExchangeIssue.exchange_id == exchange_id)
            .order_by(ExchangeIssue.created_at, ExchangeIssue.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.post("/{exchange_id}/resolve", response_model=ExchangeResponse)
async def resolve(
    exchange_id: UUID,
    data: ResolutionInput,
    actor: AdminUser,
    session: Session,
):
    return await service.resolve(session, actor, exchange_id, data)


@router.get("/{exchange_id}", response_model=ExchangeResponse)
async def detail(exchange_id: UUID, actor: CurrentUser, session: Session):
    exchange = await session.scalar(
        select(Exchange).where(
            Exchange.id == exchange_id,
            or_(Exchange.requester_id == actor.id, Exchange.owner_id == actor.id),
        )
    )
    if exchange is None:
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    return exchange
