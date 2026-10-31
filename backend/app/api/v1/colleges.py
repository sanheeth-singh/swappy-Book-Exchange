from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.modules.colleges.admin_schemas import CollegeResponse
from app.modules.colleges.models import Campus, College
from app.modules.colleges.schemas import CampusResponse

router = APIRouter(tags=["campus directory"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/colleges", response_model=list[CollegeResponse])
async def colleges(user: CurrentUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(College)
            .where(College.is_active.is_(True))
            .order_by(College.name, College.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()


@router.get("/campuses", response_model=list[CampusResponse])
async def campuses(
    user: CurrentUser,
    session: Session,
    limit: Limit = 100,
    offset: Offset = 0,
    college_id: UUID | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
):
    query = (
        select(Campus, College.name)
        .join(College)
        .where(Campus.is_active.is_(True), College.is_active.is_(True))
    )
    if college_id is not None:
        query = query.where(Campus.college_id == college_id)
    if q:
        query = query.where(
            or_(
                Campus.name.icontains(q.strip(), autoescape=True),
                College.name.icontains(q.strip(), autoescape=True),
                Campus.city.icontains(q.strip(), autoescape=True),
            )
        )
    rows = (
        await session.execute(
            query.order_by(College.name, Campus.name, Campus.city, Campus.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        CampusResponse(
            id=c.id, college_id=c.college_id, name=c.name, city=c.city, college_name=name
        )
        for c, name in rows
    ]
