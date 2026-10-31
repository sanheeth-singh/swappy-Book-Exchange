from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from fastapi import Response
from jwt import InvalidTokenError
from pydantic import ValidationError
from starlette.requests import Request

from app.api.dependencies.csrf import require_trusted_origin
from app.core.config import Settings, get_settings
from app.core.errors import DomainError
from app.core.security import decode_token, issue_token
from app.modules.auth.cookies import clear_refresh_cookie, set_refresh_cookie
from app.modules.auth.errors import SessionError
from app.modules.auth.tokens import (
    csrf_for_session,
    digest_refresh_token,
    new_refresh_token,
    parse_refresh_token,
    refresh_matches,
    require_csrf,
)


def request(headers):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/refresh",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        }
    )


def test_refresh_tokens_are_random_opaque_and_only_match_their_own_digest():
    token_id, raw = new_refresh_token()
    _, other = new_refresh_token()
    assert parse_refresh_token(raw) == token_id
    assert raw != other
    assert len(raw) == 76
    assert len(digest_refresh_token(raw)) == 64
    assert raw not in digest_refresh_token(raw)
    assert refresh_matches(raw, digest_refresh_token(raw))
    assert not refresh_matches(other, digest_refresh_token(raw))


@pytest.mark.parametrize("raw", [None, "", "x" * 10000, "not-a-token", "a" * 32 + ".../bad"])
def test_malformed_refresh_credentials_are_rejected(raw):
    with pytest.raises(SessionError):
        parse_refresh_token(raw)


def test_csrf_tokens_are_bound_to_the_login_session():
    sid = uuid4()
    token = csrf_for_session(sid)
    require_csrf(sid, token)
    for invalid in [None, "", "é" * 64, csrf_for_session(uuid4())]:
        with pytest.raises(DomainError):
            require_csrf(sid, invalid)


def test_hostile_and_null_origins_are_rejected():
    for headers in [
        {"Origin": "https://evil.example"},
        {"Origin": "null"},
        {"Referer": "https://evil.example/form"},
        {"Sec-Fetch-Site": "cross-site"},
        {},
    ]:
        with pytest.raises(DomainError):
            require_trusted_origin(request(headers))


def test_trusted_origins_and_same_origin_metadata_are_supported():
    for headers in [
        {"Origin": get_settings().api_origin},
        {"Origin": get_settings().cors_origins[0]},
        {"Referer": get_settings().api_origin + "/docs"},
        {"Sec-Fetch-Site": "same-origin"},
    ]:
        require_trusted_origin(request(headers))


def test_insecure_none_cookie_and_wildcard_origins_are_rejected():
    base = dict(
        database_url="postgresql+asyncpg://test/test",
        jwt_secret="test-secret-with-more-than-32-characters",
        _env_file=None,
    )
    with pytest.raises(ValidationError):
        Settings(**base, refresh_cookie_samesite="none", refresh_cookie_secure=False)
    with pytest.raises(ValidationError):
        Settings(**base, cors_origins=["*"])
    with pytest.raises(ValidationError):
        Settings(**base, api_origin="https://api.example.com", refresh_cookie_secure=False)


def test_secure_refresh_cookie_uses_host_prefix_and_is_deletable(monkeypatch):
    monkeypatch.setattr(get_settings(), "refresh_cookie_secure", True)
    response = Response()
    set_refresh_cookie(response, "opaque-test-value", datetime.now(UTC) + timedelta(days=1))
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie
    assert cookie.startswith("__Host-swappy_refresh=")
    assert "Path=/;" in cookie and "SameSite=lax" in cookie
    assert "Domain=" not in cookie
    response = Response()
    clear_refresh_cookie(response)
    assert "Max-Age=0" in response.headers["set-cookie"]


def test_legacy_and_wrong_type_access_tokens_are_rejected_and_session_caps_expiry():
    uid, sid = uuid4(), uuid4()
    token = issue_token(uid, sid, expires_at=datetime.now(UTC) + timedelta(seconds=60))
    payload = jwt.decode(
        token,
        get_settings().jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        audience="swappy-api",
        issuer="swappy",
    )
    assert payload["exp"] - payload["iat"] <= 60
    payload.pop("sid")
    legacy = jwt.encode(payload, get_settings().jwt_secret.get_secret_value(), algorithm="HS256")
    with pytest.raises(InvalidTokenError):
        decode_token(legacy)
    payload["sid"] = str(sid)
    payload["type"] = "refresh"
    wrong_type = jwt.encode(
        payload, get_settings().jwt_secret.get_secret_value(), algorithm="HS256"
    )
    with pytest.raises(InvalidTokenError):
        decode_token(wrong_type)


async def test_credential_cors_preflight_allows_only_configured_frontend():
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://test",
    ) as client:
        allowed_origin = get_settings().cors_origins[0]
        headers = {
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-CSRF-Token,Content-Type",
        }
        response = await client.options("/api/v1/auth/refresh", headers=headers)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == allowed_origin
        assert response.headers["access-control-allow-credentials"] == "true"
        response = await client.options(
            "/api/v1/auth/refresh",
            headers={
                **headers,
                "Origin": "https://evil.example",
            },
        )
        assert "access-control-allow-origin" not in response.headers


async def test_invalid_refresh_clears_cookie_but_bad_origin_does_not():
    from unittest.mock import AsyncMock

    from httpx import ASGITransport, AsyncClient

    from app.api.dependencies.database import get_session
    from app.main import create_app

    app = create_app()
    database = AsyncMock()

    async def no_database():
        yield database

    app.dependency_overrides[get_session] = no_database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/refresh",
            headers={
                "Origin": get_settings().api_origin,
                "Cookie": "swappy_refresh=malformed",
            },
        )
        assert response.status_code == 401
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "Max-Age=0" in response.headers["set-cookie"]
        assert response.headers["cache-control"] == "no-store"
        response = await client.post(
            "/api/v1/auth/refresh",
            headers={
                "Origin": "https://evil.example",
                "Cookie": "swappy_refresh=malformed",
            },
        )
        assert response.status_code == 403
        assert "set-cookie" not in response.headers
    database.get.assert_not_awaited()
