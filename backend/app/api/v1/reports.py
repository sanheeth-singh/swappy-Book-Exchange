from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.core.errors import DomainError
from app.modules.moderation.models import Report
from app.modules.moderation.schemas import ReportInput, ReportResponse
from app.modules.moderation.service import submit_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportResponse, status_code=201)
async def report(data: ReportInput, actor: CurrentUser, session: Session):
    return await submit_report(session, actor, data)


@router.get("/me", response_model=list[ReportResponse])
async def my_reports(
    actor: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return (
        await session.scalars(
            select(Report)
            .where(
                Report.reporter_id == actor.id,
            )
            .order_by(Report.created_at.desc(), Report.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()


@router.get("/{report_id}", response_model=ReportResponse)
async def report_detail(report_id: UUID, actor: CurrentUser, session: Session):
    row = await session.scalar(
        select(Report).where(
            Report.id == report_id,
            Report.reporter_id == actor.id,
        )
    )
    if row is None:
        raise DomainError("report_not_found", "Report not found.", 404)
    return row
