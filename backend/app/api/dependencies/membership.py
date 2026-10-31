from typing import Annotated

from fastapi import Depends
from sqlalchemy import select

from app.api.dependencies.authentication import CurrentUser
from app.api.dependencies.database import Session
from app.core.errors import DomainError
from app.modules.colleges.models import Campus, Membership
from app.modules.colleges.policies import require_browsing, require_participation
from app.modules.users.models import User


async def require_campus_browser(user: CurrentUser, session: Session) -> User:
    require_browsing(name=user.display_name, campus_id=user.campus_id)
    campus = await session.get(Campus, user.campus_id)
    if campus is None or not campus.is_active:
        raise DomainError("campus_inactive", "Campus is not currently available.")
    return user


CampusBrowser = Annotated[User, Depends(require_campus_browser)]


async def require_verified_membership(user: CampusBrowser, session: Session) -> Membership:
    membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership is None:
        raise DomainError("membership_required", "Submit campus proof for review.")
    require_participation(
        status=membership.status,
        active=membership.active,
        campus_id=membership.campus_id,
        selected_campus_id=user.campus_id,
        expires_at=membership.expires_at,
    )
    return membership


VerifiedMembership = Annotated[Membership, Depends(require_verified_membership)]
