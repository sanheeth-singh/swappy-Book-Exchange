from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.dependencies.authentication import AdminUser
from app.api.dependencies.database import Session
from app.core.errors import DomainError
from app.modules.moderation import service
from app.modules.moderation.models import ModerationAction, Report
from app.modules.moderation.schemas import (
    ActionResponse,
    AdminReportResponse,
    ReportStatus,
    RestoreInput,
    RestoreResponse,
    ReviewInput,
)

router = APIRouter(prefix="/moderation", tags=["moderation"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/reports", response_model=list[AdminReportResponse])
async def report_queue(
    actor: AdminUser,
    session: Session,
    status: ReportStatus = "OPEN",
    limit: Limit = 20,
    offset: Offset = 0,
):
    return (
        await session.scalars(
            select(Report)
            .where(
                Report.status == status,
            )
            .order_by(Report.created_at, Report.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/reports/{report_id}", response_model=AdminReportResponse)
async def detail(report_id: UUID, actor: AdminUser, session: Session):
    report = await session.get(Report, report_id)
    if report is None:
        raise DomainError("report_not_found", "Report not found.", 404)
    return report


@router.post("/reports/{report_id}/review", response_model=AdminReportResponse)
async def review(report_id: UUID, data: ReviewInput, actor: AdminUser, session: Session):
    return await service.review_report(session, actor, report_id, data)


@router.post("/users/{user_id}/restore", response_model=RestoreResponse)
async def restore_user(user_id: UUID, data: RestoreInput, actor: AdminUser, session: Session):
    return await service.restore_user(session, actor, user_id, data.reason)


@router.post("/listings/{listing_id}/restore", response_model=RestoreResponse)
async def restore_listing(listing_id: UUID, data: RestoreInput, actor: AdminUser, session: Session):
    return await service.restore_listing(session, actor, listing_id, data.reason)


@router.get("/actions", response_model=list[ActionResponse])
async def actions(actor: AdminUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(ModerationAction)
            .order_by(
                ModerationAction.created_at.desc(),
                ModerationAction.id,
            )
            .offset(offset)
            .limit(limit)
        )
    ).all()
