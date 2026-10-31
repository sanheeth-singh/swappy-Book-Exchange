from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import DomainError
from app.modules.auth.errors import SessionError
from app.modules.auth.models import LoginSession, RefreshCredential
from app.modules.auth.tokens import (
    csrf_for_session,
    digest_refresh_token,
    new_refresh_token,
    parse_refresh_token,
    refresh_matches,
    require_csrf,
)
from app.modules.users.models import User


@dataclass(frozen=True)
class IssuedSession:
    user: User
    session: LoginSession
    refresh_token: str = field(repr=False)


async def lock_user(session: AsyncSession, user_id: UUID) -> User:
    # Same first lock as profile/membership/exchange/moderation mutations.
    user = await session.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise SessionError()
    return user


async def create_login(
    session: AsyncSession,
    user_id: UUID,
    expected_password_hash: str,
    user_agent: str,
) -> IssuedSession:
    user = await lock_user(session, user_id)
    if not user.is_active or user.hashed_password != expected_password_hash:
        raise SessionError("invalid_credentials", "Invalid credentials.")
    now = datetime.now(UTC)
    family = LoginSession(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        last_refreshed_at=now,
        expires_at=now + timedelta(days=get_settings().refresh_session_days),
        user_agent=user_agent[:255],
    )
    session.add(family)
    # There are no ORM relationships; explicitly insert the parent first.
    await session.flush()
    token_id, raw = new_refresh_token()
    session.add(
        RefreshCredential(
            id=token_id,
            session_id=family.id,
            token_hash=digest_refresh_token(raw),
        )
    )
    await session.commit()
    return IssuedSession(user=user, session=family, refresh_token=raw)


async def load_refresh(
    session: AsyncSession,
    raw: str | None,
    *,
    lock: bool,
) -> tuple[User, LoginSession, RefreshCredential]:
    if raw is None:
        raise SessionError()
    token_id = parse_refresh_token(raw)
    credential = await session.get(RefreshCredential, token_id)
    if credential is None or not refresh_matches(raw, credential.token_hash):
        raise SessionError()
    family = await session.get(LoginSession, credential.session_id)
    if family is None:
        raise SessionError()
    if lock:
        user = await lock_user(session, family.user_id)
        family = await session.scalar(
            select(LoginSession)
            .where(LoginSession.id == credential.session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        credential = await session.scalar(
            select(RefreshCredential)
            .where(RefreshCredential.id == token_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    else:
        user = await session.get(User, family.user_id)
    if family is None or credential is None or user is None:
        raise SessionError()
    if not refresh_matches(raw, credential.token_hash):
        raise SessionError()
    return user, family, credential


def require_live_family(user: User, family: LoginSession, now: datetime) -> None:
    if not user.is_active or family.revoked_at is not None or family.expires_at <= now:
        raise SessionError()


async def bootstrap_csrf(session: AsyncSession, raw: str | None) -> tuple[UUID, str]:
    user, family, credential = await load_refresh(session, raw, lock=False)
    require_live_family(user, family, datetime.now(UTC))
    if credential.consumed_at is not None:
        raise SessionError()
    # Read-only. Only the POST refresh flow revokes a family on detected replay.
    return family.id, csrf_for_session(family.id)


async def rotate(
    session: AsyncSession,
    raw: str | None,
    csrf: str | None,
) -> IssuedSession:
    user, family, credential = await load_refresh(session, raw, lock=True)
    require_csrf(family.id, csrf)
    now = datetime.now(UTC)
    require_live_family(user, family, now)
    if credential.consumed_at is not None:
        family.revoked_at = now
        family.revocation_reason = "refresh_reuse"
        # Persist revocation before raising; otherwise dependency cleanup rolls it back.
        await session.commit()
        raise SessionError("refresh_reused", "Session ended after token reuse. Sign in again.")
    credential.consumed_at = now
    family.last_refreshed_at = now
    # Free the partial unique index slot before inserting the next current token.
    await session.flush()
    token_id, replacement = new_refresh_token()
    session.add(
        RefreshCredential(
            id=token_id,
            session_id=family.id,
            token_hash=digest_refresh_token(replacement),
        )
    )
    await session.commit()
    return IssuedSession(user=user, session=family, refresh_token=replacement)


async def logout(session: AsyncSession, raw: str | None, csrf: str | None) -> None:
    if raw is None:
        return
    try:
        _, family, _ = await load_refresh(session, raw, lock=True)
    except SessionError:
        # An absent, expired-cleaned-up, or unrecognized credential is already signed out.
        return
    require_csrf(family.id, csrf)
    if family.revoked_at is None:
        family.revoked_at = datetime.now(UTC)
        family.revocation_reason = "logout"
    await session.commit()


async def logout_all(session: AsyncSession, actor: User) -> None:
    user = await lock_user(session, actor.id)
    if not user.is_active:
        raise SessionError()
    families = (
        await session.scalars(
            select(LoginSession)
            .where(
                LoginSession.user_id == actor.id,
                LoginSession.revoked_at.is_(None),
            )
            .order_by(LoginSession.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()
    for family in families:
        family.revoked_at = datetime.now(UTC)
        family.revocation_reason = "logout_all"
    await session.commit()


async def revoke_session(session: AsyncSession, actor: User, session_id: UUID) -> None:
    user = await lock_user(session, actor.id)
    if not user.is_active:
        raise SessionError()
    family = await session.scalar(
        select(LoginSession)
        .where(
            LoginSession.id == session_id,
            LoginSession.user_id == actor.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if family is None:
        raise DomainError("session_not_found", "Session not found.", 404)
    if family.revoked_at is None:
        family.revoked_at = datetime.now(UTC)
        family.revocation_reason = "manual"
    await session.commit()


async def purge_sessions(session: AsyncSession, limit: int = 1000) -> int:
    cutoff = datetime.now(UTC) - timedelta(days=7)
    ids = list(
        (
            await session.scalars(
                select(LoginSession.id)
                .where(
                    or_(
                        LoginSession.expires_at <= cutoff,
                        LoginSession.revoked_at <= cutoff,
                    )
                )
                .order_by(LoginSession.id)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        ).all()
    )
    if ids:
        await session.execute(delete(LoginSession).where(LoginSession.id.in_(ids)))
    await session.commit()
    return len(ids)
