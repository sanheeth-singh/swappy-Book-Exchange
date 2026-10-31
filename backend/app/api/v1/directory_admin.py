from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.dependencies.authentication import AdminUser
from app.api.dependencies.csrf import require_trusted_origin
from app.api.dependencies.database import Session
from app.modules.colleges import admin_service as service
from app.modules.colleges.admin_schemas import (
    AdminCampusResponse,
    AvailabilityInput,
    CampusCreate,
    CampusEdit,
    CollegeCreate,
    CollegeEdit,
    CollegeResponse,
    DirectoryActionResponse,
    DirectoryImpact,
)
from app.modules.colleges.models import Campus, College, DirectoryAction

router = APIRouter(prefix="/admin", tags=["directory administration"])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
origin = [Depends(require_trusted_origin)]


@router.get("/colleges", response_model=list[CollegeResponse])
async def colleges(actor: AdminUser, session: Session, limit: Limit = 20, offset: Offset = 0):
    return (
        await session.scalars(
            select(College).order_by(College.name, College.id).limit(limit).offset(offset)
        )
    ).all()


@router.post("/colleges", response_model=CollegeResponse, status_code=201, dependencies=origin)
async def create_college(data: CollegeCreate, actor: AdminUser, session: Session):
    return await service.create_college(session, actor, data)


@router.patch("/colleges/{college_id}", response_model=CollegeResponse, dependencies=origin)
async def edit_college(college_id: UUID, data: CollegeEdit, actor: AdminUser, session: Session):
    return await service.edit_college(session, actor, college_id, data)


@router.post("/colleges/{college_id}/status", response_model=CollegeResponse, dependencies=origin)
async def college_status(
    college_id: UUID, data: AvailabilityInput, actor: AdminUser, session: Session
):
    return await service.set_availability(session, actor, college_id, data, is_college=True)


@router.get("/colleges/{college_id}/impact", response_model=DirectoryImpact)
async def college_impact(college_id: UUID, actor: AdminUser, session: Session):
    return await service.impact(session, college_id, is_college=True)


@router.get("/campuses", response_model=list[AdminCampusResponse])
async def campuses(
    actor: AdminUser,
    session: Session,
    limit: Limit = 20,
    offset: Offset = 0,
    college_id: UUID | None = None,
):
    query = select(Campus, College).join(College)
    if college_id is not None:
        query = query.where(Campus.college_id == college_id)
    rows = (
        await session.execute(
            query.order_by(College.name, Campus.name, Campus.city, Campus.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        AdminCampusResponse(
            id=c.id,
            college_id=c.college_id,
            college_name=p.name,
            name=c.name,
            city=c.city,
            is_active=c.is_active,
            college_is_active=p.is_active,
            effective_is_active=c.is_active and p.is_active,
        )
        for c, p in rows
    ]


@router.post("/campuses", response_model=AdminCampusResponse, status_code=201, dependencies=origin)
async def create_campus(data: CampusCreate, actor: AdminUser, session: Session):
    return await service.create_campus(session, actor, data)


@router.patch("/campuses/{campus_id}", response_model=AdminCampusResponse, dependencies=origin)
async def edit_campus(campus_id: UUID, data: CampusEdit, actor: AdminUser, session: Session):
    return await service.edit_campus(session, actor, campus_id, data)


@router.post(
    "/campuses/{campus_id}/status", response_model=AdminCampusResponse, dependencies=origin
)
async def campus_status(
    campus_id: UUID, data: AvailabilityInput, actor: AdminUser, session: Session
):
    return await service.set_availability(session, actor, campus_id, data, is_college=False)


@router.get("/campuses/{campus_id}/impact", response_model=DirectoryImpact)
async def campus_impact(campus_id: UUID, actor: AdminUser, session: Session):
    return await service.impact(session, campus_id, is_college=False)


@router.get("/directory/actions", response_model=list[DirectoryActionResponse])
async def actions(
    actor: AdminUser,
    session: Session,
    limit: Limit = 20,
    offset: Offset = 0,
    college_id: UUID | None = None,
    campus_id: UUID | None = None,
):
    query = select(DirectoryAction)
    if college_id is not None:
        query = query.where(DirectoryAction.college_id == college_id)
    if campus_id is not None:
        query = query.where(DirectoryAction.campus_id == campus_id)
    return (
        await session.scalars(
            query.order_by(DirectoryAction.created_at.desc(), DirectoryAction.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
