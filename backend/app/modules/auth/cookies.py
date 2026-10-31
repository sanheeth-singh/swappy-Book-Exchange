from datetime import UTC, datetime

from fastapi import Response

from app.core.config import get_settings

REFRESH_COOKIE = "swappy_refresh"
COOKIE_PATH = "/api/v1/auth"


def refresh_cookie_name() -> str:
    return "__Host-swappy_refresh" if get_settings().refresh_cookie_secure else REFRESH_COOKIE


def refresh_cookie_path() -> str:
    return "/" if get_settings().refresh_cookie_secure else COOKIE_PATH


def set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    settings = get_settings()
    response.set_cookie(
        key=refresh_cookie_name(),
        value=raw_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path=refresh_cookie_path(),
        max_age=max(0, int((expires_at - datetime.now(UTC)).total_seconds())),
        expires=expires_at,
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        refresh_cookie_name(),
        path=refresh_cookie_path(),
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
    )
