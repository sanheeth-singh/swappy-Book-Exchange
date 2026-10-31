from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()
_DUMMY_HASH = _hasher.hash("dummy-login-timing-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    try:
        valid = _hasher.verify(hashed or _DUMMY_HASH, password)
        return valid and hashed is not None
    except (VerificationError, InvalidHashError):
        return False


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    session_id: UUID


def issue_token(user_id: UUID, session_id: UUID, *, expires_at: datetime | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expiration = now + timedelta(minutes=settings.access_token_minutes)
    if expires_at is not None:
        expiration = min(expiration, expires_at)
    return jwt.encode(
        {
            "sub": str(user_id),
            "sid": str(session_id),
            "jti": str(uuid4()),
            "type": "access",
            "iat": now,
            "exp": expiration,
            "iss": "swappy",
            "aud": "swappy-api",
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def decode_token(token: str) -> AccessClaims:
    payload = jwt.decode(
        token,
        get_settings().jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        issuer="swappy",
        audience="swappy-api",
        options={"require": ["sub", "sid", "jti", "type", "exp", "iat"]},
    )
    if payload["type"] != "access":
        raise jwt.InvalidTokenError("Expected access token")
    UUID(payload["jti"])
    return AccessClaims(user_id=UUID(payload["sub"]), session_id=UUID(payload["sid"]))
