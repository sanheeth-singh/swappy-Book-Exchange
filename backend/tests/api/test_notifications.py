import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.modules.colleges.models import Membership
from app.modules.colleges.service import purge_expired_proof
from app.modules.exchanges.models import Exchange
from app.modules.notifications.events import NotificationEvent, NotificationKind
from app.modules.notifications.models import Notification
from app.modules.notifications.service import emit
from app.modules.users.models import User
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import proof, setup, signup


@pytest.fixture
async def staff(client, session_factory):
    headers = await signup(client, "notify-admin@example.com")
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "notify-admin@example.com"))
        user.is_admin = True
        await session.commit()
    return headers


async def items(client, headers, **params):
    response = await client.get("/api/v1/notifications", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


async def test_proposal_notifies_only_owner_and_inbox_is_available_without_membership(
    client, students
):
    exchange = await propose(client, students)
    inbox = await items(client, students[1][0])
    assert len(inbox) == 1
    assert inbox[0]["kind"] == "EXCHANGE_PROPOSED"
    assert inbox[0]["resource_id"] == exchange["id"]
    assert await items(client, students[0][0]) == []
    assert await items(client, students[2][0]) == []
    explorer = await signup(client, "explorer@example.com")
    assert await items(client, explorer) == []
    assert "recipient_id" not in inbox[0] and "event_key" not in inbox[0]
    assert (
        await client.post(
            "/api/v1/notifications",
            headers=students[0][0],
            json={
                "recipient_id": students[2][1]["owner_id"],
                "body": "forged message",
            },
        )
    ).status_code == 405


async def test_only_recipient_can_mark_read_or_use_cursor_and_read_is_idempotent(client, students):
    await propose(client, students)
    notification = (await items(client, students[1][0]))[0]
    nid = notification["id"]
    for other in [0, 2]:
        assert (
            await client.post(f"/api/v1/notifications/{nid}/read", headers=students[other][0])
        ).status_code == 404
        assert (
            await client.get(f"/api/v1/notifications?before={nid}", headers=students[other][0])
        ).status_code == 404
        assert (
            await client.post(
                "/api/v1/notifications/read-all",
                headers=students[other][0],
                json={"through_id": nid},
            )
        ).status_code == 404
    first = await client.post(f"/api/v1/notifications/{nid}/read", headers=students[1][0])
    second = await client.post(f"/api/v1/notifications/{nid}/read", headers=students[1][0])
    assert first.json()["read_at"] == second.json()["read_at"]
    assert (await client.get("/api/v1/notifications/unread-count", headers=students[1][0])).json()[
        "unread_count"
    ] == 0


async def test_confirmation_retries_and_completion_do_not_duplicate_notifications(
    client, students, session_factory
):
    exchange = await propose(client, students)
    await action(client, students[1][0], exchange["id"], "accept")
    for _ in range(2):
        assert (await action(client, students[0][0], exchange["id"], "confirm")).status_code == 200
    for _ in range(2):
        assert (await action(client, students[1][0], exchange["id"], "confirm")).status_code == 200
    owner = await items(client, students[1][0])
    requester = await items(client, students[0][0])
    assert sum(n["kind"] == "EXCHANGE_CONFIRMATION" for n in owner) == 1
    assert sum(n["kind"] == "EXCHANGE_COMPLETED" for n in owner) == 1
    assert sum(n["kind"] == "EXCHANGE_COMPLETED" for n in requester) == 1
    assert any(n["kind"] == "EXCHANGE_ACCEPTED" for n in requester)


async def test_business_failure_rolls_back_proposal_and_its_notification(
    client, students, session_factory, monkeypatch
):
    from app.modules.exchanges import service

    async def fail(session):
        await session.flush()
        raise RuntimeError("injected before commit")

    with monkeypatch.context() as patch:
        patch.setattr(service, "commit", fail)
        with pytest.raises(RuntimeError, match="injected before commit"):
            await propose(client, students)
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Exchange)) == 0
        assert await session.scalar(select(func.count()).select_from(Notification)) == 0


async def test_notification_failure_also_rolls_back_business_change(
    client, students, session_factory, monkeypatch
):
    from app.modules.exchanges import service

    async def fail(*args, **kwargs):
        raise RuntimeError("notification insert failed")

    with monkeypatch.context() as patch:
        patch.setattr(service, "notify", fail)
        with pytest.raises(RuntimeError, match="notification insert failed"):
            await propose(client, students)
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Exchange)) == 0


async def test_cursor_pagination_and_mark_all_leave_newer_notifications_unread(
    client, students, session_factory
):
    recipient = UUID(students[0][1]["owner_id"])
    async with session_factory() as session:
        for i in range(5):
            await emit(
                session,
                NotificationEvent(
                    recipient,
                    NotificationKind.EXCHANGE_ACCEPTED,
                    uuid4(),
                    f"test:{i}",
                ),
            )
        await session.commit()
    first = (await client.get("/api/v1/notifications?limit=2", headers=students[0][0])).json()
    assert len(first["items"]) == 2 and first["next_cursor"] is not None
    second = (
        await client.get(
            f"/api/v1/notifications?limit=2&before={first['next_cursor']}", headers=students[0][0]
        )
    ).json()
    assert not ({n["id"] for n in first["items"]} & {n["id"] for n in second["items"]})
    async with session_factory() as session:
        await emit(
            session,
            NotificationEvent(
                recipient,
                NotificationKind.EXCHANGE_ACCEPTED,
                uuid4(),
                "test:newer",
            ),
        )
        await session.commit()
    read = await client.post(
        "/api/v1/notifications/read-all",
        headers=students[0][0],
        json={"through_id": first["items"][0]["id"]},
    )
    assert read.json()["updated_count"] == 5
    assert len(await items(client, students[0][0], unread_only=True)) == 1


async def test_concurrent_event_retries_create_one_notification(client, students, session_factory):
    event = NotificationEvent(
        UUID(students[0][1]["owner_id"]),
        NotificationKind.EXCHANGE_ACCEPTED,
        uuid4(),
        "dedupe:test",
    )

    async def insert_one():
        async with session_factory() as session:
            await emit(session, event)
            await session.commit()

    await asyncio.wait_for(asyncio.gather(insert_one(), insert_one()), timeout=15)
    assert len(await items(client, students[0][0])) == 1


async def test_membership_queue_and_approval_notifications_exclude_sensitive_proof(
    client, campuses, staff
):
    student = await signup(client)
    await setup(client, student, campuses[0])
    submission = await client.post("/api/v1/membership/submissions", headers=student, files=proof())
    sid = submission.json()["submission_id"]
    queue = await items(client, staff)
    assert any(n["kind"] == "MEMBERSHIP_SUBMITTED" for n in queue)
    review = await client.post(
        f"/api/v1/membership/submissions/{sid}/review",
        headers=staff,
        json={
            "decision": "VERIFIED",
            "expires_at": (datetime.now(UTC) + timedelta(days=90)).isoformat(),
        },
    )
    assert review.status_code == 200, review.text
    inbox = await items(client, student)
    assert [n["kind"] for n in inbox] == ["MEMBERSHIP_APPROVED"]
    assert "document" not in str(inbox).lower()
    assert "submission_id" not in str(inbox)


async def test_general_report_privacy_review_and_restore_notifications(client, students, staff):
    report = await client.post(
        "/api/v1/reports",
        headers=students[0][0],
        json={
            "target_type": "USER",
            "target_user_id": students[1][1]["owner_id"],
            "reason": "HARASSMENT",
            "details": "Private allegations must not enter notifications.",
        },
    )
    assert report.status_code == 201
    rid = report.json()["id"]
    assert await items(client, students[1][0]) == []  # No notification about being reported.
    assert any(n["kind"] == "REPORT_SUBMITTED" for n in await items(client, staff))
    reviewed = await client.post(
        f"/api/v1/moderation/reports/{rid}/review",
        headers=staff,
        json={
            "action": "RESTRICT_USER",
            "summary": "A reviewed restriction has been applied.",
        },
    )
    assert reviewed.status_code == 200, reviewed.text
    affected = await items(client, students[1][0])
    assert [n["kind"] for n in affected] == ["PARTICIPATION_RESTRICTED"]
    assert affected[0]["resource_id"] == students[1][1]["owner_id"]
    assert rid not in str(affected) and "allegations" not in str(affected)
    for _ in range(2):
        result = await client.post(
            f"/api/v1/moderation/users/{students[1][1]['owner_id']}/restore",
            headers=staff,
            json={"reason": "The restriction has been reviewed and lifted."},
        )
        assert result.status_code == 200
    assert (
        sum(n["kind"] == "PARTICIPATION_RESTORED" for n in await items(client, students[1][0])) == 1
    )
    assert any(n["kind"] == "REPORT_REVIEWED" for n in await items(client, students[0][0]))


async def test_blocking_only_sends_generic_pending_closure_not_a_block_disclosure(client, students):
    await propose(client, students)
    response = await client.post(
        f"/api/v1/blocks/{students[1][1]['owner_id']}", headers=students[0][0]
    )
    assert response.status_code == 200
    for i in [0, 1]:
        inbox = await items(client, students[i][0])
        closed = [n for n in inbox if n["kind"] == "EXCHANGE_REJECTED"]
        assert len(closed) == 1 and "block" not in closed[0]["body"].lower()


async def test_expiration_and_proof_cleanup_emit_once(client, students, session_factory, campuses):
    from app.modules.exchanges.service import expire_batch

    exchange = await propose(client, students)
    await action(client, students[1][0], exchange["id"], "accept")
    async with session_factory() as session:
        row = await session.get(Exchange, UUID(exchange["id"]))
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
        assert await expire_batch(session) == 1
        assert await expire_batch(session) == 0
    for i in [0, 1]:
        assert (
            sum(n["kind"] == "EXCHANGE_EXPIRED" for n in await items(client, students[i][0])) == 1
        )
    pending = await signup(client, "proof-cleanup@example.com")
    await setup(client, pending, campuses[0])
    await client.post("/api/v1/membership/submissions", headers=pending, files=proof())
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "proof-cleanup@example.com"))
        membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
        membership.document_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
        assert await purge_expired_proof(session) == 1
        assert await purge_expired_proof(session) == 0
    assert sum(n["kind"] == "MEMBERSHIP_PROOF_EXPIRED" for n in await items(client, pending)) == 1


async def test_user_locks_allow_foreign_key_notifications_without_cross_recipient_deadlock(
    client, students, session_factory
):
    from app.modules.users.queries import lock_users

    first, second = [UUID(students[i][1]["owner_id"]) for i in [0, 1]]
    ready_a, ready_b = asyncio.Event(), asyncio.Event()

    async def work(own, other, ready, wait):
        async with session_factory() as session:
            await lock_users(session, [own])
            ready.set()
            await wait.wait()
            await emit(
                session,
                NotificationEvent(
                    other,
                    NotificationKind.EXCHANGE_ACCEPTED,
                    uuid4(),
                    f"cross:{own}",
                ),
            )
            await session.commit()

    await asyncio.wait_for(
        asyncio.gather(
            work(first, second, ready_a, ready_b),
            work(second, first, ready_b, ready_a),
        ),
        timeout=15,
    )
    assert len(await items(client, students[0][0])) == 1
    assert len(await items(client, students[1][0])) == 1


async def test_notifications_follow_session_revocation(client, students):
    await propose(client, students)
    assert (await client.post("/api/v1/auth/logout-all", headers=students[1][0])).status_code == 204
    assert (await client.get("/api/v1/notifications", headers=students[1][0])).status_code == 401
