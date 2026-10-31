from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy import select

from app.api.dependencies.database import Session
from app.core.security import decode_token
from app.modules.auth.models import LoginSession
from app.modules.users.models import User

_oauth = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


@dataclass(frozen=True)
class AuthenticationContext:
    user: User
    session: LoginSession


async def get_authentication_context(
    session: Session,
    token: Annotated[str, Depends(_oauth)],
) -> AuthenticationContext:
    try:
        claims = decode_token(token)
    except (InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    row = (
        await session.execute(
            select(User, LoginSession)
            .join(
                LoginSession,
                LoginSession.user_id == User.id,
            )
            .where(
                User.id == claims.user_id,
                User.is_active.is_(True),
                LoginSession.id == claims.session_id,
                LoginSession.revoked_at.is_(None),
                LoginSession.expires_at > datetime.now(UTC),
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(401, "Session unavailable", headers={"WWW-Authenticate": "Bearer"})
    return AuthenticationContext(user=row[0], session=row[1])


AuthContext = Annotated[AuthenticationContext, Depends(get_authentication_context)]


async def get_current_user(context: AuthContext) -> User:
    return context.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Reviewer access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
