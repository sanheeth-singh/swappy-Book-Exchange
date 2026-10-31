from datetime import UTC, datetime, timedelta
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import select

from app.modules.users.models import User


def proof():
    stream = BytesIO()
    Image.new("RGB", (40, 30), "white").save(stream, "PNG")
    return {"document": ("proof.png", stream.getvalue(), "image/png")}


async def signup(client, email="student@example.com"):
    response = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "A-strong-password-123"}
    )
    assert response.status_code == 201, response.text
    login = await client.post(
        "/api/v1/auth/token", data={"username": email, "password": "A-strong-password-123"}
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def setup(client, headers, campus):
    result = await client.put(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"display_name": "Student", "campus_id": str(campus)},
    )
    assert result.status_code == 200, result.text


@pytest.mark.asyncio
async def test_signup_profile_campus_browsing_and_direct_id_isolation(client, campuses):
    headers = await signup(client)
    assert (await client.get("/api/v1/books", headers=headers)).status_code == 403
    await setup(client, headers, campuses[0])
    result = await client.get("/api/v1/books", headers=headers)
    assert result.status_code == 200
    assert {book["title"] for book in result.json()} == {"Campus A book"}
    other = await client.get("/api/v1/books/" + str(campuses[3]), headers=headers)
    assert other.status_code == 404
    assert "password" not in str((await client.get("/api/v1/users/me", headers=headers)).json())


@pytest.mark.asyncio
async def test_upload_is_not_approval_and_non_admin_cannot_approve(client, campuses):
    headers = await signup(client)
    await setup(client, headers, campuses[0])
    response = await client.post("/api/v1/membership/submissions", headers=headers, files=proof())
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "PENDING"
    assert (await client.get("/api/v1/membership/eligibility", headers=headers)).status_code == 403
    review = await client.post(
        f"/api/v1/membership/submissions/{response.json()['submission_id']}/review",
        headers=headers,
        json={
            "decision": "VERIFIED",
            "expires_at": (datetime.now(UTC) + timedelta(days=90)).isoformat(),
        },
    )
    assert review.status_code == 403
    me = await client.get("/api/v1/users/me", headers=headers)
    assert "document" not in str(me.json())


@pytest.mark.asyncio
async def test_approval_then_campus_change_revokes_eligibility(client, campuses, session_factory):
    student = await signup(client)
    admin = await signup(client, "reviewer@example.com")
    async with session_factory() as session:
        reviewer = await session.scalar(select(User).where(User.email == "reviewer@example.com"))
        reviewer.is_admin = True
        await session.commit()
    await setup(client, student, campuses[0])
    submission = await client.post("/api/v1/membership/submissions", headers=student, files=proof())
    sid = submission.json()["submission_id"]
    doc = await client.get(f"/api/v1/membership/submissions/{sid}/document", headers=student)
    assert doc.status_code == 403
    review = await client.post(
        f"/api/v1/membership/submissions/{sid}/review",
        headers=admin,
        json={
            "decision": "VERIFIED",
            "expires_at": (datetime.now(UTC) + timedelta(days=90)).isoformat(),
        },
    )
    assert review.status_code == 200, review.text
    assert (await client.get("/api/v1/membership/eligibility", headers=student)).status_code == 200
    assert (
        await client.get(f"/api/v1/membership/submissions/{sid}/document", headers=admin)
    ).status_code == 404  # proof purged on review
    await setup(client, student, campuses[1])
    assert (await client.get("/api/v1/membership/eligibility", headers=student)).status_code == 403
    stale = await client.post(
        f"/api/v1/membership/submissions/{sid}/review",
        headers=admin,
        json={"decision": "REJECTED", "reason": "stale"},
    )
    assert stale.status_code == 409


@pytest.mark.asyncio
async def test_authentication_and_duplicate_registration(client):
    await signup(client, "Student@example.com")
    duplicate = await client.post(
        "/api/v1/auth/register",
        json={"email": "student@example.com", "password": "A-strong-password-123"},
    )
    assert duplicate.status_code == 409
    denied = await client.post(
        "/api/v1/auth/token", data={"username": "student@example.com", "password": "wrong"}
    )
    assert denied.status_code == 401
    assert (await client.get("/api/v1/users/me")).status_code == 401
    assert (
        await client.get("/api/v1/users/me", headers={"Authorization": "Bearer forged"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_privilege_fields_and_fake_proof_rejected(client, campuses):
    headers = await signup(client)
    await setup(client, headers, campuses[0])
    forged = await client.put(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"display_name": "Student", "campus_id": str(campuses[0]), "is_admin": True},
    )
    assert forged.status_code == 422
    bad = await client.post(
        "/api/v1/membership/submissions",
        headers=headers,
        files={"document": ("fake.png", b"not an image", "image/png")},
    )
    assert bad.status_code == 422
