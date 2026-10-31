from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.csrf import require_trusted_origin
from app.api.dependencies.database import Session
from app.modules.auth.cookies import clear_refresh_cookie
from app.modules.users import account, profiles
from app.modules.users.avatars import AVATARS
from app.modules.users.profile_schemas import (
    AvatarResponse,
    DeactivationEligibility,
    DeactivationInput,
    DeactivationResponse,
    PasswordChangeInput,
    ProfileBooks,
    PublicDetailsInput,
    PublicProfile,
)
from app.modules.users.schemas import UserResponse

router = APIRouter(prefix="/users", tags=["profiles and account settings"])


@router.get("/avatars", response_model=list[AvatarResponse])
async def avatars(actor: CurrentUser):
    return [AvatarResponse(id=item.id, name=item.name, url=item.url) for item in AVATARS]


@router.get("/me/profile", response_model=PublicProfile)
async def own_profile(actor: CurrentUser, session: Session):
    return await profiles.profile(session, actor, actor.id)


@router.patch("/me/profile", response_model=UserResponse)
async def edit_profile(data: PublicDetailsInput, actor: CurrentUser, session: Session):
    return await profiles.edit_details(session, actor, data)


@router.get("/me/deactivation", response_model=DeactivationEligibility)
async def deactivation_eligibility(actor: CurrentUser, session: Session):
    return await account.deactivation_eligibility(session, actor)


@router.post("/me/password", status_code=204, dependencies=[Depends(require_trusted_origin)])
async def change_password(
    data: PasswordChangeInput, actor: CurrentUser, session: Session, response: Response
):
    await account.change_password(session, actor, data.current_password, data.new_password)
    clear_refresh_cookie(response)


@router.post(
    "/me/deactivate",
    response_model=DeactivationResponse,
    dependencies=[Depends(require_trusted_origin)],
)
async def deactivate(
    data: DeactivationInput, actor: CurrentUser, session: Session, response: Response
):
    when = await account.deactivate(session, actor, data.current_password)
    clear_refresh_cookie(response)
    return DeactivationResponse(deactivated_at=when)


@router.get("/{user_id}/profile", response_model=PublicProfile)
async def public_profile(user_id: UUID, actor: CurrentUser, session: Session):
    return await profiles.profile(session, actor, user_id)


@router.get("/{user_id}/books", response_model=ProfileBooks)
async def profile_books(
    user_id: UUID,
    actor: CurrentUser,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before: UUID | None = None,
):
    return await profiles.books(session, actor, user_id, limit, before)
