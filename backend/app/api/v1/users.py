from fastapi import APIRouter

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.modules.users.schemas import ProfileInput, UserResponse
from app.modules.users.service import update_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return user


@router.put("/me/profile", response_model=UserResponse)
async def profile(data: ProfileInput, user: CurrentUser, session: Session):
    return await update_profile(session, user, data)
