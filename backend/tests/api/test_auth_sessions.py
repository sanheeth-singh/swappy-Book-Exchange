import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import issue_token
from app.modules.auth.cookies import REFRESH_COOKIE
from app.modules.auth.models import LoginSession, RefreshCredential
from app.modules.auth.service import purge_sessions
from app.modules.auth.tokens import digest_refresh_token
from app.modules.users.models import User
from tests.api.test_onboarding import signup

PASSWORD = "A-strong-password-123"


async def login(client, email="student@example.com"):
    response = await client.post(
        "/api/v1/auth/token",
        data={
            "username": email,
            "password": PASSWORD,
        },
    )
    assert response.status_code == 200, response.text
    raw = response.cookies.get(REFRESH_COOKIE)
    assert raw is not None
    return response.json(), raw


def bearer(payload):
    return {"Authorization": f"Bearer {payload['access_token']}"}


def cookie(raw, csrf=None):
    result = {"Cookie": f"{REFRESH_COOKIE}={raw}"}
    if csrf is not None:
        result["X-CSRF-Token"] = csrf
    return result


async def test_login_keeps_refresh_secret_out_of_json_and_database(client, session_factory):
    await signup(client)
    payload, raw = await login(client)
    assert "refresh_token" not in payload
    assert payload["expires_in"] > 0
    async with session_factory() as session:
        credential = await session.scalar(
            select(RefreshCredential).where(
                RefreshCredential.session_id == UUID(payload["session_id"])
            )
        )
        assert credential.token_hash == digest_refresh_token(raw)
        assert raw not in credential.token_hash
        assert credential.consumed_at is None
    assert (await client.get("/api/v1/users/me", headers=bearer(payload))).status_code == 200


async def test_rotation_replaces_token_but_preserves_absolute_expiration(client, session_factory):
    await signup(client)
    original, old = await login(client)
    response = await client.post(
        "/api/v1/auth/refresh", headers=cookie(old, original["csrf_token"])
    )
    assert response.status_code == 200, response.text
    replacement = response.cookies.get(REFRESH_COOKIE)
    assert replacement and replacement != old
    rotated = response.json()
    assert rotated["session_id"] == original["session_id"]
    assert rotated["refresh_expires_at"] == original["refresh_expires_at"]
    assert rotated["access_token"] != original["access_token"]
    async with session_factory() as session:
        credentials = (
            await session.scalars(
                select(RefreshCredential).where(
                    RefreshCredential.session_id == UUID(original["session_id"])
                )
            )
        ).all()
        assert len(credentials) == 2
        assert sum(c.consumed_at is None for c in credentials) == 1
    bootstrap = await client.get("/api/v1/auth/csrf", headers=cookie(replacement))
    assert bootstrap.status_code == 200
    assert bootstrap.json()["csrf_token"] == original["csrf_token"]


async def test_consumed_token_reuse_revokes_that_family_and_all_its_access_tokens(
    client, session_factory
):
    await signup(client)
    original, old = await login(client)
    other_session, _ = await login(client)
    first = await client.post("/api/v1/auth/refresh", headers=cookie(old, original["csrf_token"]))
    current_raw = first.cookies.get(REFRESH_COOKIE)
    replay = await client.post("/api/v1/auth/refresh", headers=cookie(old, original["csrf_token"]))
    assert replay.status_code == 401
    assert "Max-Age=0" in replay.headers["set-cookie"]
    assert (await client.get("/api/v1/users/me", headers=bearer(original))).status_code == 401
    assert (await client.get("/api/v1/users/me", headers=bearer(first.json()))).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/refresh", headers=cookie(current_raw, original["csrf_token"])
        )
    ).status_code == 401
    assert (await client.get("/api/v1/users/me", headers=bearer(other_session))).status_code == 200
    async with session_factory() as session:
        family = await session.get(LoginSession, UUID(original["session_id"]))
        assert family.revocation_reason == "refresh_reuse"


async def test_wrong_secret_cannot_revoke_a_known_selector(client, session_factory):
    await signup(client)
    original, raw = await login(client)
    forged = raw[:-1] + ("A" if raw[-1] != "A" else "B")
    response = await client.post(
        "/api/v1/auth/refresh", headers=cookie(forged, original["csrf_token"])
    )
    assert response.status_code == 401
    assert (await client.get("/api/v1/users/me", headers=bearer(original))).status_code == 200
    async with session_factory() as session:
        assert (await session.get(LoginSession, UUID(original["session_id"]))).revoked_at is None


async def test_missing_csrf_and_untrusted_origins_do_not_consume_or_revoke(client, session_factory):
    await signup(client)
    original, raw = await login(client)
    missing = await client.post("/api/v1/auth/refresh", headers=cookie(raw))
    assert missing.status_code == 403
    assert "set-cookie" not in missing.headers
    hostile_headers = {**cookie(raw, original["csrf_token"]), "Origin": "https://evil.example"}
    assert (await client.post("/api/v1/auth/refresh", headers=hostile_headers)).status_code == 403
    assert (await client.get("/api/v1/auth/csrf", headers=hostile_headers)).status_code == 403
    async with session_factory() as session:
        family = await session.get(LoginSession, UUID(original["session_id"]))
        credential = await session.scalar(
            select(RefreshCredential).where(RefreshCredential.session_id == family.id)
        )
        assert family.revoked_at is None and credential.consumed_at is None
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    ).status_code == 200


async def test_logout_revokes_access_without_an_access_token_and_is_repeatable(client):
    await signup(client)
    original, raw = await login(client)
    bad = await client.post("/api/v1/auth/logout", headers=cookie(raw))
    assert bad.status_code == 403
    result = await client.post("/api/v1/auth/logout", headers=cookie(raw, original["csrf_token"]))
    assert result.status_code == 204
    assert "Max-Age=0" in result.headers["set-cookie"]
    assert (await client.get("/api/v1/users/me", headers=bearer(original))).status_code == 401
    again = await client.post("/api/v1/auth/logout", headers=cookie(raw, original["csrf_token"]))
    assert again.status_code == 204


async def test_logout_everywhere_and_session_ownership(client):
    await signup(client)
    one, _ = await login(client)
    two, raw_two = await login(client)
    await signup(client, "other@example.com")
    other, _ = await login(client, "other@example.com")
    sessions = await client.get("/api/v1/auth/sessions", headers=bearer(one))
    assert sessions.status_code == 200
    assert any(s["id"] == one["session_id"] and s["is_current"] for s in sessions.json())
    assert all("token_hash" not in s for s in sessions.json())
    assert other["session_id"] not in {s["id"] for s in sessions.json()}
    denied = await client.post(
        f"/api/v1/auth/sessions/{one['session_id']}/revoke", headers=bearer(other)
    )
    assert denied.status_code == 404
    assert (await client.post("/api/v1/auth/logout-all", headers=bearer(one))).status_code == 204
    for payload in [one, two]:
        assert (await client.get("/api/v1/users/me", headers=bearer(payload))).status_code == 401
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw_two, two["csrf_token"]))
    ).status_code == 401
    assert (await client.get("/api/v1/users/me", headers=bearer(other))).status_code == 200


async def test_single_session_revocation_preserves_other_logins(client):
    await signup(client)
    one, _ = await login(client)
    two, _ = await login(client)
    result = await client.post(
        f"/api/v1/auth/sessions/{two['session_id']}/revoke", headers=bearer(one)
    )
    assert result.status_code == 204
    assert (await client.get("/api/v1/users/me", headers=bearer(two))).status_code == 401
    assert (await client.get("/api/v1/users/me", headers=bearer(one))).status_code == 200


async def test_deactivated_accounts_and_expired_families_cannot_refresh(client, session_factory):
    await signup(client)
    original, raw = await login(client)
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "student@example.com"))
        user.is_active = False
        await session.commit()
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    ).status_code == 401
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "student@example.com"))
        user.is_active = True
        family = await session.get(LoginSession, UUID(original["session_id"]))
        family.created_at = datetime.now(UTC) - timedelta(days=20)
        family.expires_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()
    assert (await client.get("/api/v1/users/me", headers=bearer(original))).status_code == 401
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    ).status_code == 401


async def test_restricted_students_keep_login_refresh_and_support_access(client, session_factory):
    await signup(client)
    original, raw = await login(client)
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "student@example.com"))
        user.is_participation_restricted = True
        await session.commit()
    refreshed = await client.post(
        "/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"])
    )
    assert refreshed.status_code == 200
    assert (await client.get("/api/v1/users/me", headers=bearer(refreshed.json()))).json()[
        "is_participation_restricted"
    ]


async def test_simultaneous_refreshes_trigger_strict_family_replay_revocation(
    client, session_factory
):
    await signup(client)
    original, raw = await login(client)
    results = await asyncio.wait_for(
        asyncio.gather(
            *[
                client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
                for _ in range(2)
            ]
        ),
        timeout=15,
    )
    assert sorted(r.status_code for r in results) == [200, 401]
    winner = next(r.json() for r in results if r.status_code == 200)
    assert (await client.get("/api/v1/users/me", headers=bearer(winner))).status_code == 401
    async with session_factory() as session:
        family = await session.get(LoginSession, UUID(original["session_id"]))
        assert family.revocation_reason == "refresh_reuse"


async def test_refresh_racing_logout_all_cannot_restore_a_revoked_session(client, session_factory):
    await signup(client)
    original, raw = await login(client)
    refreshed, logged_out = await asyncio.wait_for(
        asyncio.gather(
            client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"])),
            client.post("/api/v1/auth/logout-all", headers=bearer(original)),
        ),
        timeout=15,
    )
    # Either logout authenticated before the refresh or fails only after a concurrent
    # revocation; refresh alone never revokes. In this race logout must succeed.
    assert logged_out.status_code == 204
    assert refreshed.status_code in (200, 401)
    assert (await client.get("/api/v1/users/me", headers=bearer(original))).status_code == 401
    async with session_factory() as session:
        assert (
            await session.get(LoginSession, UUID(original["session_id"]))
        ).revoked_at is not None


async def test_unknown_or_legacy_session_claims_cannot_authorize_requests(client):
    await signup(client)
    original, _ = await login(client)
    claims = jwt.decode(
        original["access_token"],
        get_settings().jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        audience="swappy-api",
        issuer="swappy",
    )
    for change in [{"sid": str(uuid4())}, {"sid": None}]:
        modified = {**claims, **change}
        if change["sid"] is None:
            del modified["sid"]
        token = jwt.encode(
            modified, get_settings().jwt_secret.get_secret_value(), algorithm="HS256"
        )
        assert (
            await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
        ).status_code == 401


async def test_refresh_cookie_is_not_accepted_as_a_bearer_token(client):
    await signup(client)
    original, raw = await login(client)
    assert (
        await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {raw}"})
    ).status_code == 401
    expired = issue_token(
        UUID((await client.get("/api/v1/users/me", headers=bearer(original))).json()["id"]),
        UUID(original["session_id"]),
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    assert (
        await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {expired}"})
    ).status_code == 401
    # Refresh does not need a nonexpired access token.
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    ).status_code == 200


async def test_cleanup_removes_old_families_and_cascades_refresh_history(client, session_factory):
    await signup(client)
    async with session_factory() as session:
        families = (await session.scalars(select(LoginSession))).all()
        for family in families:
            family.created_at = datetime.now(UTC) - timedelta(days=30)
            family.expires_at = datetime.now(UTC) - timedelta(days=10)
        await session.commit()
        assert await purge_sessions(session) == 1
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(RefreshCredential)) == 0


async def test_failed_rotation_rolls_back_consumption_and_original_token_can_retry(
    client, session_factory, monkeypatch
):
    from app.modules.auth import service

    await signup(client)
    original, raw = await login(client)

    def fail_generation():
        raise RuntimeError("injected refresh failure")

    with monkeypatch.context() as patch:
        patch.setattr(service, "new_refresh_token", fail_generation)
        with pytest.raises(RuntimeError, match="injected refresh failure"):
            await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    async with session_factory() as session:
        credential = await session.scalar(
            select(RefreshCredential).where(
                RefreshCredential.session_id == UUID(original["session_id"])
            )
        )
        assert credential.consumed_at is None
    assert (
        await client.post("/api/v1/auth/refresh", headers=cookie(raw, original["csrf_token"]))
    ).status_code == 200


async def test_login_csrf_and_missing_origin_are_rejected(client, session_factory):
    await signup(client)
    for origin in ["https://evil.example", "null"]:
        response = await client.post(
            "/api/v1/auth/token",
            headers={"Origin": origin},
            data={
                "username": "student@example.com",
                "password": PASSWORD,
            },
        )
        assert response.status_code == 403
    # Remove the test client's default allowed Origin explicitly.
    request = client.build_request(
        "POST",
        "/api/v1/auth/token",
        data={
            "username": "student@example.com",
            "password": PASSWORD,
        },
    )
    del request.headers["Origin"]
    assert (await client.send(request)).status_code == 403
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(LoginSession)) == 1
