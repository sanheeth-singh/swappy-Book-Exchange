from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.authentication import AuthContext
from app.api.dependencies.csrf import require_trusted_origin
from app.api.dependencies.database import Session
from app.core.config import get_settings
from app.core.security import issue_token, verify_password
from app.modules.auth import service
from app.modules.auth.cookies import clear_refresh_cookie, refresh_cookie_name, set_refresh_cookie
from app.modules.auth.models import LoginSession
from app.modules.auth.schemas import CsrfResponse, SessionResponse, TokenResponse
from app.modules.auth.tokens import csrf_for_session
from app.modules.users.models import User
from app.modules.users.schemas import RegisterInput, UserResponse
from app.modules.users.service import register

router = APIRouter(prefix="/auth", tags=["auth"])
_origin = [Depends(require_trusted_origin)]
CsrfHeader = Annotated[str | None, Header(alias="X-CSRF-Token")]


def token_response(bundle: service.IssuedSession, response: Response) -> TokenResponse:
    family = bundle.session
    access = issue_token(bundle.user.id, family.id, expires_at=family.expires_at)
    now = datetime.now(UTC)
    duration = (
        min(
            now + timedelta(minutes=get_settings().access_token_minutes),
            family.expires_at,
        )
        - now
    )
    set_refresh_cookie(response, bundle.refresh_token, family.expires_at)
    return TokenResponse(
        access_token=access,
        expires_in=max(0, int(duration.total_seconds())),
        csrf_token=csrf_for_session(family.id),
        session_id=family.id,
        refresh_expires_at=family.expires_at,
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(data: RegisterInput, session: Session):
    return await register(session, data)


@router.post("/token", response_model=TokenResponse, dependencies=_origin)
async def login(
    request: Request,
    response: Response,
    session: Session,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    if len(form.password) > 128 or len(form.username) > 254:
        raise HTTPException(401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    user = await session.scalar(select(User).where(User.email == form.username.strip().lower()))
    expected_hash = user.hashed_password if user else None
    valid = await run_in_threadpool(verify_password, form.password, expected_hash)
    if not valid or not user or not user.is_active:
        raise HTTPException(401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    bundle = await service.create_login(
        session,
        user.id,
        expected_hash,
        request.headers.get("user-agent", ""),
    )
    return token_response(bundle, response)


@router.get("/csrf", response_model=CsrfResponse, dependencies=_origin)
async def csrf_token(request: Request, session: Session):
    session_id, token = await service.bootstrap_csrf(
        session, request.cookies.get(refresh_cookie_name())
    )
    return CsrfResponse(session_id=session_id, csrf_token=token)


@router.post("/refresh", response_model=TokenResponse, dependencies=_origin)
async def refresh(
    request: Request,
    response: Response,
    session: Session,
    csrf: CsrfHeader = None,
):
    bundle = await service.rotate(session, request.cookies.get(refresh_cookie_name()), csrf)
    return token_response(bundle, response)


@router.post("/logout", status_code=204, dependencies=_origin)
async def logout(
    request: Request,
    response: Response,
    session: Session,
    csrf: CsrfHeader = None,
):
    await service.logout(session, request.cookies.get(refresh_cookie_name()), csrf)
    clear_refresh_cookie(response)


@router.post("/logout-all", status_code=204, dependencies=_origin)
async def logout_all(context: AuthContext, response: Response, session: Session):
    # Explicit bearer authorization protects this endpoint against ambient-cookie CSRF.
    await service.logout_all(session, context.user)
    clear_refresh_cookie(response)


@router.get("/sessions", response_model=list[SessionResponse])
async def sessions(
    context: AuthContext,
    session: Session,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    rows = (
        await session.scalars(
            select(LoginSession)
            .where(
                LoginSession.user_id == context.user.id,
                LoginSession.revoked_at.is_(None),
                LoginSession.expires_at > datetime.now(UTC),
            )
            .order_by(LoginSession.created_at.desc(), LoginSession.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return [
        SessionResponse(
            id=row.id,
            created_at=row.created_at,
            expires_at=row.expires_at,
            last_refreshed_at=row.last_refreshed_at,
            user_agent=row.user_agent,
            is_current=row.id == context.session.id,
        )
        for row in rows
    ]


@router.post("/sessions/{session_id}/revoke", status_code=204, dependencies=_origin)
async def revoke_session(
    session_id: UUID,
    context: AuthContext,
    response: Response,
    session: Session,
):
    await service.revoke_session(session, context.user, session_id)
    if session_id == context.session.id:
        clear_refresh_cookie(response)
