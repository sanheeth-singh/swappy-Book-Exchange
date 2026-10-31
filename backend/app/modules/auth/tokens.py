import hashlib
import hmac
import re
import secrets
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.core.errors import DomainError
from app.modules.auth.errors import SessionError

_REFRESH_PATTERN = re.compile(r"^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$")


def new_refresh_token() -> tuple[UUID, str]:
    token_id = uuid4()
    return token_id, f"{token_id.hex}.{secrets.token_urlsafe(32)}"


def parse_refresh_token(raw: str | None) -> UUID:
    if raw is None or len(raw) != 76 or not _REFRESH_PATTERN.fullmatch(raw):
        raise SessionError()
    return UUID(hex=raw[:32])


def digest_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("ascii")).hexdigest()


def refresh_matches(raw: str, expected_hash: str) -> bool:
    return hmac.compare_digest(digest_refresh_token(raw), expected_hash)


def csrf_for_session(session_id: UUID) -> str:
    return hmac.new(
        get_settings().jwt_secret.get_secret_value().encode(),
        f"swappy:csrf:{session_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def require_csrf(session_id: UUID, presented: str | None) -> None:
    if (
        presented is None
        or re.fullmatch(r"[0-9a-f]{64}", presented) is None
        or not hmac.compare_digest(csrf_for_session(session_id), presented)
    ):
        raise DomainError("csrf_invalid", "Reload the session CSRF token and try again.", 403)
