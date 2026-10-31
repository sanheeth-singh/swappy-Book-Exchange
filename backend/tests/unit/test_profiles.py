from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from xml.etree import ElementTree

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.main import create_app
from app.modules.users.avatars import AVATAR_IDS, AVATARS, DEFAULT_AVATAR, avatar_url
from app.modules.users.profile_schemas import PublicDetailsInput, PublicProfile
from app.modules.users.profiles import verified_membership


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"avatar_id": "https://example.com/avatar.svg"},
        {"avatar_id": "../secret"},
        {"avatar_id": None},
        {"display_name": None},
        {"display_name": "  "},
        {"bio": "x" * 301},
        {"bio": "bad\x00bio"},
        {"reading_interests": None},
        {"reading_interests": "History"},
        {"reading_interests": [""]},
        {"reading_interests": ["a" * 41]},
        {"reading_interests": list("abcdefghi")},
        {"reading_interests": [7]},
        {"is_active": False},
        {"campus_id": "forged"},
    ],
)
def test_public_fields_reject_invalid_or_sensitive_changes(payload):
    with pytest.raises(ValidationError):
        PublicDetailsInput(**payload)


def test_partial_normalization_and_explicit_clear():
    data = PublicDetailsInput(
        bio="  Hello reader! ", reading_interests=[" History ", "history", "Sci-fi"]
    )
    assert data.bio == "Hello reader!"
    assert data.reading_interests == ["History", "Sci-fi"]
    assert "avatar_id" not in data.model_dump(exclude_unset=True)
    assert PublicDetailsInput(bio=None).model_dump(exclude_unset=True) == {"bio": None}
    assert PublicDetailsInput(reading_interests=[]).reading_interests == []
    assert "email" not in PublicProfile.model_fields
    assert "is_participation_restricted" not in PublicProfile.model_fields


@pytest.mark.parametrize(
    "change",
    [
        "expired",
        "pending",
        "inactive_membership",
        "wrong_campus",
        "inactive_campus",
        "inactive_user",
        "none",
    ],
)
def test_membership_badge_rechecks_live_conditions(change):
    now = datetime.now(UTC)
    user = SimpleNamespace(is_active=True, campus_id="a")
    campus = SimpleNamespace(is_active=True)
    membership = SimpleNamespace(
        status="VERIFIED", active=True, campus_id="a", expires_at=now + timedelta(days=1)
    )
    if change == "expired":
        membership.expires_at = now
    elif change == "pending":
        membership.status = "PENDING"
    elif change == "inactive_membership":
        membership.active = False
    elif change == "wrong_campus":
        membership.campus_id = "b"
    elif change == "inactive_campus":
        campus.is_active = False
    elif change == "inactive_user":
        user.is_active = False
    else:
        membership = None
    assert not verified_membership(user, campus, membership, now)


def test_live_badge_is_not_a_participation_permission():
    user = SimpleNamespace(is_active=True, campus_id="a", is_participation_restricted=True)
    membership = SimpleNamespace(status="VERIFIED", active=True, campus_id="a", expires_at=None)
    assert verified_membership(user, SimpleNamespace(is_active=True), membership, datetime.now(UTC))


async def test_avatar_assets_served_and_packaged_with_catalog():
    base = Path(__file__).resolve().parents[2] / "app/assets/avatars"
    assert len(AVATARS) == len(set(AVATAR_IDS)) == 15
    assert DEFAULT_AVATAR in AVATAR_IDS
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://test"
    ) as client:
        for item in AVATARS:
            assert avatar_url(item.id) == item.url
            ElementTree.parse(base / f"{item.id}.svg")
            response = await client.get(item.url)
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("image/svg+xml")
        assert (await client.get("/assets/avatars/not-real.svg")).status_code == 404
        response = await client.options(
            "/api/v1/users/me/profile",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert response.status_code == 200


@pytest.mark.parametrize("status", ["PENDING", "ACCEPTED", "WAITING_CONFIRMATION"])
async def test_deactivation_gate_rejects_every_unsettled_status(monkeypatch, status):
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from app.core.errors import DomainError
    from app.modules.users import account
    from app.modules.users.profile_schemas import DeactivationEligibility

    user = SimpleNamespace(id=uuid4(), is_active=True)
    monkeypatch.setattr(account, "reauthenticate", AsyncMock(return_value=user))
    counts = {"pending": 0, "accepted": 0, "waiting_confirmation": 0}
    counts[status.lower()] = 1
    monkeypatch.setattr(
        account,
        "deactivation_eligibility",
        AsyncMock(return_value=DeactivationEligibility(can_deactivate=False, **counts)),
    )
    session = AsyncMock()
    with pytest.raises(DomainError) as exc:
        await account.deactivate(session, user, "current password")
    assert exc.value.code == "exchanges_unsettled" and exc.value.status == 409
    assert user.is_active
    session.commit.assert_not_awaited()


async def test_wrong_password_cannot_change_credentials(monkeypatch):
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from app.core.errors import DomainError
    from app.modules.users import account

    user = SimpleNamespace(id=uuid4(), is_active=True, hashed_password="original hash")
    monkeypatch.setattr(account, "lock_users", AsyncMock(return_value={user.id: user}))
    monkeypatch.setattr(account, "run_in_threadpool", AsyncMock(return_value=False))
    session = AsyncMock()
    with pytest.raises(DomainError) as exc:
        await account.change_password(session, user, "wrong password", "new password")
    assert exc.value.code == "password_incorrect"
    assert user.hashed_password == "original hash"
    session.commit.assert_not_awaited()
