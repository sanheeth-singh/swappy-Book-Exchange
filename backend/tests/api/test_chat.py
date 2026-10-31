import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.modules.chat.models import ChatMessage
from app.modules.exchanges.models import Exchange
from app.modules.notifications.models import Notification
from app.modules.users.models import User
from tests.api.test_exchanges import action, propose


async def accepted(client, students):
    row = await propose(client, students)
    assert (await action(client, students[1][0], row["id"], "accept")).status_code == 200
    return row["id"]


def url(eid):
    return f"/api/v1/exchanges/{eid}/chat"


async def send(client, headers, eid, body="Meet at the library", key=None):
    return await client.post(
        url(eid) + "/messages",
        headers=headers,
        json={"body": body, "client_message_id": str(key or uuid4())},
    )


async def test_pending_and_nonparticipants_cannot_access_chat(client, students, session_factory):
    row = await propose(client, students)
    assert (await send(client, students[0][0], row["id"])).status_code == 409
    eid = row["id"]
    await action(client, students[1][0], eid, "accept")
    async with session_factory() as session:
        third = await session.get(User, UUID(students[2][1]["owner_id"]))
        third.is_admin = True
        await session.commit()
    assert (await send(client, students[2][0], eid)).status_code == 404
    assert (await client.get(url(eid) + "/messages", headers=students[2][0])).status_code == 404


async def test_message_retry_receipts_pagination_and_notification_privacy(client, students):
    eid = await accepted(client, students)
    key = uuid4()
    first = await send(client, students[0][0], eid, key=key)
    assert first.status_code == 200, first.text
    assert (await send(client, students[0][0], eid, key=key)).json()["id"] == first.json()["id"]
    assert (await send(client, students[0][0], eid, "different body", key)).status_code == 409
    second = await send(client, students[0][0], eid, "At noon")
    page = (await client.get(url(eid) + "/messages?limit=1", headers=students[1][0])).json()
    assert page["unread_count"] == 2 and page["next_before"] == 2
    older = (await client.get(url(eid) + "/messages?before=2", headers=students[1][0])).json()
    assert older["items"][0]["id"] == first.json()["id"]
    for mid in (second.json()["id"], first.json()["id"]):
        read = await client.post(
            url(eid) + "/read", headers=students[1][0], json={"through_message_id": mid}
        )
        assert read.json()["sequence"] == 2
    page = (await client.get(url(eid) + "/messages", headers=students[0][0])).json()
    assert page["other_read"]["sequence"] == 2
    page = (await client.get(url(eid) + "/messages", headers=students[1][0])).json()
    assert page["unread_count"] == 0
    notices = (await client.get("/api/v1/notifications", headers=students[1][0])).json()["items"]
    messages = [n for n in notices if n["kind"] == "CHAT_MESSAGE"]
    assert len(messages) == 2 and "library" not in str(messages)


async def test_block_stops_both_senders_history_and_handover_remain(client, students):
    eid = await accepted(client, students)
    assert (await send(client, students[0][0], eid)).status_code == 200
    target = students[1][1]["owner_id"]
    await client.post(f"/api/v1/blocks/{target}", headers=students[0][0])
    for i in (0, 1):
        assert (await send(client, students[i][0], eid)).status_code == 403
        page = (await client.get(url(eid) + "/messages", headers=students[i][0])).json()
        assert len(page["items"]) == 1 and not page["can_send"]
    for i in (0, 1):
        assert (await action(client, students[i][0], eid, "confirm")).status_code == 200


@pytest.mark.parametrize("ending", ["cancel", "complete", "expire"])
async def test_terminal_states_readonly(client, students, session_factory, ending):
    eid = await accepted(client, students)
    first = await send(client, students[0][0], eid)
    if ending == "cancel":
        await action(client, students[0][0], eid, "cancel")
    elif ending == "complete":
        await action(client, students[0][0], eid, "confirm")
        assert (await send(client, students[0][0], eid)).status_code == 200
        await action(client, students[1][0], eid, "confirm")
    else:
        async with session_factory() as session:
            row = await session.get(Exchange, UUID(eid))
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            await session.commit()
    assert (await send(client, students[0][0], eid)).status_code == 409
    assert (await client.get(url(eid) + "/messages", headers=students[0][0])).status_code == 200
    assert (
        await client.post(
            url(eid) + "/read",
            headers=students[1][0],
            json={"through_message_id": first.json()["id"]},
        )
    ).status_code == 200


async def test_cross_exchange_receipt_denied(client, students):
    eid = await accepted(client, students)
    assert (
        await client.post(
            url(eid) + "/read", headers=students[0][0], json={"through_message_id": str(uuid4())}
        )
    ).status_code == 404


async def test_concurrent_retries_are_single_message(client, students):
    eid = await accepted(client, students)
    key = uuid4()
    a, b = await asyncio.wait_for(
        asyncio.gather(
            send(client, students[0][0], eid, key=key), send(client, students[0][0], eid, key=key)
        ),
        timeout=15,
    )
    assert a.status_code == b.status_code == 200
    assert a.json()["id"] == b.json()["id"]


async def test_notification_failure_rolls_back_message(
    client, students, session_factory, monkeypatch
):
    from app.modules.chat import service

    eid = await accepted(client, students)

    async def fail(*args, **kwargs):
        raise RuntimeError("injected notification failure")

    monkeypatch.setattr(service, "notify", fail)
    with pytest.raises(RuntimeError):
        await send(client, students[0][0], eid)
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(ChatMessage)) == 0
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.kind == "CHAT_MESSAGE")
            )
            == 0
        )


async def test_restriction_and_revocation_stop_messages(client, students, session_factory):
    eid = await accepted(client, students)
    async with session_factory() as session:
        user = await session.get(User, UUID(students[1][1]["owner_id"]))
        user.is_participation_restricted = True
        await session.commit()
    assert (await send(client, students[0][0], eid)).status_code == 403
    assert (await client.get(url(eid) + "/messages", headers=students[0][0])).status_code == 200
    await client.post("/api/v1/auth/logout-all", headers=students[0][0])
    assert (await send(client, students[0][0], eid)).status_code == 401
