import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.modules.colleges.directory import DIRECTORY_LOCK_KEY, directory_lock
from app.modules.colleges.models import Campus, College, DirectoryAction, Membership
from app.modules.notifications.models import Notification
from app.modules.users.models import User
from tests.api.test_books import PAYLOAD
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import proof, setup, signup

PASSWORD = "A-strong-password-123"
REASON = "Reviewed directory availability."


@pytest.fixture
async def staff(client, session_factory):
    headers = await signup(client, "directory-admin@example.com")
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "directory-admin@example.com"))
        user.is_admin = True
        await session.commit()
    return headers


async def status(client, staff, kind, uid, active, password=PASSWORD):
    return await client.post(
        f"/api/v1/admin/{kind}/{uid}/status",
        headers=staff,
        json={"is_active": active, "current_password": password, "reason": REASON},
    )


async def test_admin_creates_five_colleges_and_campuses_and_audit_has_no_password(
    client, staff, students
):
    ids = []
    for i in range(5):
        college = await client.post(
            "/api/v1/admin/colleges", headers=staff, json={"name": f"College {i}", "reason": REASON}
        )
        assert college.status_code == 201, college.text
        campus = await client.post(
            "/api/v1/admin/campuses",
            headers=staff,
            json={
                "college_id": college.json()["id"],
                "name": "Main campus",
                "city": f"City {i}",
                "reason": REASON,
            },
        )
        assert campus.status_code == 201, campus.text
        ids.append(campus.json()["id"])
    assert len(set(ids)) == 5
    choices = await client.get("/api/v1/campuses?limit=100", headers=students[0][0])
    assert set(ids) <= {row["id"] for row in choices.json()}
    assert all("college_name" in row for row in choices.json())
    audits = (await client.get("/api/v1/admin/directory/actions", headers=staff)).json()
    assert len(audits) == 10
    assert all(row["source"] == "ADMIN" and row["actor_id"] for row in audits)
    assert PASSWORD not in str(audits) and "current_password" not in str(audits)
    assert (
        await client.post(
            "/api/v1/admin/colleges",
            headers=students[0][0],
            json={"name": "Forged", "reason": REASON},
        )
    ).status_code == 403
    assert (await client.get("/api/v1/admin/campuses", headers=students[0][0])).status_code == 403


async def test_normalized_duplicates_and_metadata_edits_preserve_ids(
    client, staff, students, campuses, session_factory
):
    async with session_factory() as session:
        parent = (await session.get(Campus, campuses[0])).college_id
    duplicate = await client.post(
        "/api/v1/admin/colleges",
        headers=staff,
        json={"name": "  TEST   COLLEGE  ", "reason": REASON},
    )
    assert duplicate.status_code == 409, duplicate.text
    duplicate = await client.post(
        "/api/v1/admin/campuses",
        headers=staff,
        json={
            "college_id": str(parent),
            "name": " campus   A ",
            "city": " CITY ",
            "reason": REASON,
        },
    )
    assert duplicate.status_code == 409, duplicate.text
    changed = await client.patch(
        f"/api/v1/admin/campuses/{campuses[0]}",
        headers=staff,
        json={"name": "Main Campus", "city": "New City", "reason": REASON},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["id"] == str(campuses[0]) and changed.json()["college_id"] == str(parent)
    async with session_factory() as session:
        user = await session.get(User, UUID(students[0][1]["owner_id"]))
        membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
        assert (
            user.campus_id == membership.campus_id == campuses[0]
            and membership.status == "VERIFIED"
        )
    assert (
        await client.delete(f"/api/v1/admin/campuses/{campuses[0]}", headers=staff)
    ).status_code == 405


async def test_password_guard_parent_child_flags_and_noop_notifications(
    client, staff, students, campuses, session_factory
):
    async with session_factory() as session:
        parent = (await session.get(Campus, campuses[0])).college_id
    assert (await status(client, staff, "colleges", parent, False, "wrong")).status_code == 403
    assert (await client.get("/api/v1/admin/directory/actions", headers=staff)).json() == []
    assert (await status(client, staff, "campuses", campuses[1], False)).status_code == 200
    assert (await status(client, staff, "colleges", parent, False)).status_code == 200
    assert (await client.get("/api/v1/campuses", headers=students[0][0])).json() == []
    profile = (await client.get("/api/v1/users/me/profile", headers=students[0][0])).json()
    assert not profile["membership_verified"] and not profile["campus"]["is_active"]
    rows = (await client.get("/api/v1/admin/campuses", headers=staff)).json()
    a = next(row for row in rows if row["id"] == str(campuses[0]))
    assert a["is_active"] and not a["college_is_active"] and not a["effective_is_active"]
    assert (await status(client, staff, "campuses", campuses[1], True)).status_code == 409
    async with session_factory() as session:
        before = await session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.kind == "DIRECTORY_AVAILABILITY_CHANGED")
        )
    assert (await status(client, staff, "colleges", parent, False)).status_code == 200
    async with session_factory() as session:
        after = await session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.kind == "DIRECTORY_AVAILABILITY_CHANGED")
        )
        assert before == after
    assert (await status(client, staff, "colleges", parent, True)).status_code == 200
    visible = (await client.get("/api/v1/campuses", headers=students[0][0])).json()
    assert {row["id"] for row in visible} == {str(campuses[0])}


async def test_closed_campus_blocks_new_actions_preview_and_acceptance_but_keeps_pending_history(
    client, staff, students, campuses
):
    eid = (await propose(client, students))["id"]
    await client.patch(
        f"/api/v1/books/{students[0][1]['id']}/public-preview",
        headers=students[0][0],
        json={"allow_public_preview": True},
    )
    assert (await status(client, staff, "campuses", campuses[0], False)).status_code == 200
    assert (await client.get("/api/v1/books", headers=students[0][0])).status_code == 403
    assert (await client.get("/api/v1/public/books")).json()["items"] == []
    assert (
        await client.post("/api/v1/books", headers=students[0][0], json=PAYLOAD)
    ).status_code == 403
    assert (await action(client, students[1][0], eid, "accept")).status_code == 403
    assert (await client.get(f"/api/v1/exchanges/{eid}", headers=students[0][0])).json()[
        "status"
    ] == "PENDING"
    assert (
        await client.get(
            f"/api/v1/users/{students[1][1]['owner_id']}/books", headers=students[0][0]
        )
    ).json()["items"] == []
    assert (await client.get("/api/v1/users/me", headers=students[0][0])).status_code == 200
    assert (await status(client, staff, "campuses", campuses[0], True)).status_code == 200
    assert (await action(client, students[1][0], eid, "accept")).status_code == 200


@pytest.mark.parametrize("mode", ["confirm", "support"])
async def test_existing_handover_and_support_survive_college_shutdown(
    client, staff, students, campuses, session_factory, mode
):
    eid = (await propose(client, students))["id"]
    await action(client, students[1][0], eid, "accept")
    async with session_factory() as session:
        parent = (await session.get(Campus, campuses[0])).college_id
    assert (await status(client, staff, "colleges", parent, False)).status_code == 200
    assert (
        await client.post(
            f"/api/v1/exchanges/{eid}/chat/messages",
            headers=students[0][0],
            json={"client_message_id": str(uuid4()), "body": "New chat"},
        )
    ).status_code == 403
    if mode == "confirm":
        assert (await action(client, students[0][0], eid, "confirm")).status_code == 200
        response = await action(client, students[1][0], eid, "confirm")
        assert response.status_code == 200 and response.json()["status"] == "COMPLETED"
    else:
        issue = await client.post(
            f"/api/v1/exchanges/{eid}/issues",
            headers=students[0][0],
            json={"explanation": "Please help resolve this handover."},
        )
        assert issue.status_code == 201, issue.text
        response = await client.post(
            f"/api/v1/exchanges/{eid}/resolve",
            headers=staff,
            json={"decision": "CANCEL", "reason": "Support reviewed and cancelled the exchange."},
        )
        assert response.status_code == 200 and response.json()["status"] == "CANCELLED"


async def test_closed_directory_prevents_membership_approval_and_campus_selection(
    client, staff, campuses
):
    headers = await signup(client, "pending-directory@example.com")
    await setup(client, headers, campuses[0])
    submission = await client.post("/api/v1/membership/submissions", headers=headers, files=proof())
    sid = submission.json()["submission_id"]
    await status(client, staff, "campuses", campuses[0], False)
    review = await client.post(
        f"/api/v1/membership/submissions/{sid}/review",
        headers=staff,
        json={
            "decision": "VERIFIED",
            "expires_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
        },
    )
    assert review.status_code == 403, review.text
    fresh = await signup(client, "new-directory@example.com")
    assert (
        await client.put(
            "/api/v1/users/me/profile",
            headers=fresh,
            json={"display_name": "New Reader", "campus_id": str(campuses[0])},
        )
    ).status_code == 422
    assert (
        await client.post(
            f"/api/v1/membership/submissions/{sid}/review",
            headers=staff,
            json={"decision": "REJECTED", "reason": "Campus closed during review."},
        )
    ).status_code == 200


async def test_impact_and_notification_failure_roll_back_directory_update(
    client, staff, students, campuses, session_factory, monkeypatch
):
    from app.modules.colleges import admin_service

    await propose(client, students)
    impact = await client.get(f"/api/v1/admin/campuses/{campuses[0]}/impact", headers=staff)
    assert impact.status_code == 200 and impact.json()["pending_exchanges"] == 1
    assert impact.json()["selected_users"] >= 3 and impact.json()["live_listings"] >= 3

    async def fail(*args, **kwargs):
        raise RuntimeError("notice insert failed")

    monkeypatch.setattr(admin_service, "notify_accounts", fail)
    with pytest.raises(RuntimeError):
        await status(client, staff, "campuses", campuses[0], False)
    async with session_factory() as session:
        assert (await session.get(Campus, campuses[0])).is_active
        assert await session.scalar(select(func.count()).select_from(DirectoryAction)) == 0


async def test_concurrent_duplicate_creation_produces_one_record(client, staff, session_factory):
    async def create():
        return await client.post(
            "/api/v1/admin/colleges",
            headers=staff,
            json={"name": "Concurrent College", "reason": REASON},
        )

    results = await asyncio.wait_for(asyncio.gather(create(), create()), timeout=20)
    assert sorted(row.status_code for row in results) == [201, 409]
    async with session_factory() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(College)
                .where(College.name == "Concurrent College")
            )
            == 1
        )


async def test_exclusive_directory_barrier_blocks_shared_mutations(session_factory):
    async with session_factory() as writer, session_factory() as reader:
        await directory_lock(writer, exclusive=True)
        assert not await reader.scalar(
            select(func.pg_try_advisory_xact_lock_shared(DIRECTORY_LOCK_KEY))
        )
        await writer.commit()
        await directory_lock(reader)
        await reader.commit()


async def test_cli_bootstrap_is_idempotent_audited_and_preserves_disabled_campus(session_factory):
    from app.modules.colleges.admin_service import bootstrap_campus

    async with session_factory() as session:
        a = await bootstrap_campus(
            session, "New College", "Main Campus", "City", "Operator creates a new campus."
        )
        original = a.id
        a.is_active = False
        await session.commit()
        b = await bootstrap_campus(
            session,
            " new   college ",
            " main campus ",
            " CITY ",
            "Operator retries campus creation.",
        )
        assert b.id == original and not b.is_active
        assert await session.scalar(select(func.count()).select_from(DirectoryAction)) == 2
