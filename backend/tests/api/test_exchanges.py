import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.modules.books.models import BookListing, PhysicalBook
from app.modules.exchanges.models import Exchange, Reservation
from app.modules.exchanges.service import expire_batch
from app.modules.users.models import User
from tests.api.test_books import PAYLOAD
from tests.api.test_onboarding import setup, signup


async def propose(client, students, requester=0, owner=1):
    response = await client.post(
        "/api/v1/exchanges",
        headers=students[requester][0],
        json={
            "requested_listing_id": students[owner][1]["id"],
            "offered_listing_id": students[requester][1]["id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def action(client, headers, eid, name):
    return await client.post(f"/api/v1/exchanges/{eid}/{name}", headers=headers)


async def test_complete_once_archives_and_allows_explicit_relisting(
    client, students, session_factory
):
    exchange = await propose(client, students)
    eid = exchange["id"]
    accepted = await action(client, students[1][0], eid, "accept")
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "ACCEPTED"
    book_id = students[0][1]["id"]
    assert (
        await client.put(f"/api/v1/books/{book_id}", headers=students[0][0], json=PAYLOAD)
    ).status_code == 409
    assert (await action(client, students[0][0], eid, "confirm")).json()["status"] == (
        "WAITING_CONFIRMATION"
    )
    assert (await action(client, students[0][0], eid, "confirm")).json()["status"] == (
        "WAITING_CONFIRMATION"
    )
    assert (await action(client, students[1][0], eid, "cancel")).status_code == 409
    completed = await action(client, students[1][0], eid, "confirm")
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "COMPLETED"
    assert (await action(client, students[1][0], eid, "confirm")).json()["status"] == "COMPLETED"
    # Immutable snapshots remain readable without querying archived listing endpoints.
    assert completed.json()["requested_snapshot"]["title"] == students[1][1]["title"]
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 0
        from uuid import UUID

        asset = await session.get(PhysicalBook, UUID(students[1][1]["physical_book_id"]))
        user = await session.scalar(select(User).where(User.email == "student0@example.com"))
        assert asset.owner_id == user.id
        originals = (
            await session.scalars(
                select(BookListing).where(
                    BookListing.id.in_([UUID(s[1]["id"]) for s in students[:2]])
                )
            )
        ).all()
        assert all(row.is_archived for row in originals)
    collection = (await client.get("/api/v1/books/collection", headers=students[0][0])).json()
    assert students[1][1]["physical_book_id"] in {b["id"] for b in collection}
    relisted = await client.post(
        "/api/v1/books",
        headers=students[0][0],
        json={
            **PAYLOAD,
            "physical_book_id": students[1][1]["physical_book_id"],
        },
    )
    assert relisted.status_code == 201, relisted.text
    forged = await client.post(
        "/api/v1/books",
        headers=students[1][0],
        json={
            **PAYLOAD,
            "physical_book_id": students[1][1]["physical_book_id"],
        },
    )
    assert forged.status_code == 404


async def test_concurrent_acceptance_of_shared_book_has_one_winner(
    client, students, session_factory
):
    a = await propose(client, students, 0, 1)
    b = await propose(client, students, 0, 2)
    responses = await asyncio.wait_for(
        asyncio.gather(
            action(client, students[1][0], a["id"], "accept"),
            action(client, students[2][0], b["id"], "accept"),
        ),
        timeout=15,
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    async with session_factory() as session:
        statuses = (await session.scalars(select(Exchange.status))).all()
        assert sorted(statuses) == ["ACCEPTED", "REJECTED"]
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 2


async def test_permissions_reversed_duplicates_and_pending_cancellation(client, students):
    e = await propose(client, students)
    assert (await action(client, students[0][0], e["id"], "accept")).status_code == 403
    assert (await action(client, students[2][0], e["id"], "accept")).status_code == 404
    assert (
        await client.get(f"/api/v1/exchanges/{e['id']}", headers=students[2][0])
    ).status_code == 404
    reversed_proposal = await client.post(
        "/api/v1/exchanges",
        headers=students[1][0],
        json={
            "requested_listing_id": students[0][1]["id"],
            "offered_listing_id": students[1][1]["id"],
        },
    )
    assert reversed_proposal.status_code == 409
    assert (await action(client, students[1][0], e["id"], "cancel")).status_code == 403
    assert (await action(client, students[0][0], e["id"], "cancel")).json()["status"] == "CANCELLED"


async def test_expiration_and_no_expiration_after_first_confirmation(
    client, students, session_factory
):
    from uuid import UUID

    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    async with session_factory() as session:
        row = await session.get(Exchange, UUID(e["id"]))
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
        assert await expire_batch(session) == 1
        assert await expire_batch(session) == 0
    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    await action(client, students[0][0], e["id"], "confirm")
    async with session_factory() as session:
        row = await session.get(Exchange, UUID(e["id"]))
        row.expires_at = datetime.now(UTC) - timedelta(days=10)
        await session.commit()
        assert await expire_batch(session) == 0
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 2


async def test_profile_change_guard_and_stale_pending_proposals(client, students, campuses):
    e = await propose(client, students)
    edited = await client.put(
        f"/api/v1/books/{students[0][1]['id']}",
        headers=students[0][0],
        json={**PAYLOAD, "condition": "FAIR"},
    )
    assert edited.status_code == 200
    assert (await action(client, students[1][0], e["id"], "accept")).status_code == 409
    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    change = await client.put(
        "/api/v1/users/me/profile",
        headers=students[0][0],
        json={
            "display_name": "Student",
            "campus_id": str(campuses[1]),
        },
    )
    assert change.status_code == 409
    assert (
        await client.post(f"/api/v1/books/{students[0][1]['id']}/archive", headers=students[0][0])
    ).status_code == 409


async def test_open_issue_freezes_confirmation_and_admin_resolution(
    client, students, session_factory
):
    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    await action(client, students[0][0], e["id"], "confirm")
    issue = await client.post(
        f"/api/v1/exchanges/{e['id']}/issues",
        headers=students[0][0],
        json={"explanation": "The other student disputes the handover."},
    )
    assert issue.status_code == 201, issue.text
    assert (await action(client, students[1][0], e["id"], "confirm")).status_code == 409
    denied = await client.post(
        f"/api/v1/exchanges/{e['id']}/resolve",
        headers=students[0][0],
        json={"decision": "CANCEL", "reason": "Both books have been returned."},
    )
    assert denied.status_code == 403
    admin = await signup(client, "admin@example.com")
    async with session_factory() as session:
        row = await session.scalar(select(User).where(User.email == "admin@example.com"))
        row.is_admin = True
        await session.commit()
    resolved = await client.post(
        f"/api/v1/exchanges/{e['id']}/resolve",
        headers=admin,
        json={"decision": "CANCEL", "reason": "Both books have been returned."},
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["resolved_by"] is not None
    assert resolved.json()["status"] == "CANCELLED"
    assert (await client.get("/api/v1/exchanges/admin/issues", headers=admin)).json() == []


async def test_accept_rechecks_both_memberships(client, students, session_factory):
    from app.modules.colleges.models import Membership

    e = await propose(client, students)
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "student0@example.com"))
        membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
        membership.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
    assert (await action(client, students[1][0], e["id"], "accept")).status_code == 403
    # Withdrawals remain available when eligibility expires.
    assert (await action(client, students[0][0], e["id"], "cancel")).status_code == 200


async def test_simultaneous_confirmations_transfer_only_once(client, students, session_factory):
    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    responses = await asyncio.wait_for(
        asyncio.gather(
            action(client, students[0][0], e["id"], "confirm"),
            action(client, students[1][0], e["id"], "confirm"),
        ),
        timeout=15,
    )
    assert all(r.status_code == 200 for r in responses)
    assert sorted(r.json()["status"] for r in responses) == [
        "COMPLETED",
        "WAITING_CONFIRMATION",
    ]
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 0
    assert (await action(client, students[0][0], e["id"], "confirm")).json()["status"] == (
        "COMPLETED"
    )


async def test_second_confirmation_rolls_back_all_tables_on_failure(
    client, students, session_factory, monkeypatch
):
    from uuid import UUID

    from app.modules.exchanges import service

    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    await action(client, students[0][0], e["id"], "confirm")
    async with session_factory() as session:
        asset_id = UUID(students[1][1]["physical_book_id"])
        original_owner = (await session.get(PhysicalBook, asset_id)).owner_id

    async def fail_before_commit(session):
        # Execute the actual table writes, then fail before the transaction commits.
        await session.flush()
        raise RuntimeError("injected completion failure")

    with monkeypatch.context() as patch:
        patch.setattr(service, "commit", fail_before_commit)
        with pytest.raises(RuntimeError, match="injected completion failure"):
            await action(client, students[1][0], e["id"], "confirm")
    async with session_factory() as session:
        row = await session.get(Exchange, UUID(e["id"]))
        assert row.status == "WAITING_CONFIRMATION"
        assert not row.owner_confirmed
        assert (await session.get(PhysicalBook, asset_id)).owner_id == original_owner
        assert not (await session.get(BookListing, UUID(students[1][1]["id"]))).is_archived
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 2
    assert (await action(client, students[1][0], e["id"], "confirm")).json()["status"] == (
        "COMPLETED"
    )


async def test_acceptance_versus_archive_is_atomic(client, students, session_factory):
    e = await propose(client, students)
    accepted, archived = await asyncio.wait_for(
        asyncio.gather(
            action(client, students[1][0], e["id"], "accept"),
            client.post(f"/api/v1/books/{students[0][1]['id']}/archive", headers=students[0][0]),
        ),
        timeout=15,
    )
    assert sorted([accepted.status_code, archived.status_code]) == [200, 409]
    async with session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(Reservation))
        assert count == (2 if accepted.status_code == 200 else 0)


async def test_admin_can_complete_disputed_handover_with_audit(client, students, session_factory):
    e = await propose(client, students)
    await action(client, students[1][0], e["id"], "accept")
    await action(client, students[0][0], e["id"], "confirm")
    admin = await signup(client, "resolution-admin@example.com")
    async with session_factory() as session:
        user = await session.scalar(
            select(User).where(User.email == "resolution-admin@example.com")
        )
        user.is_admin = True
        await session.commit()
    result = await client.post(
        f"/api/v1/exchanges/{e['id']}/resolve",
        headers=admin,
        json={"decision": "COMPLETE", "reason": "Both participants confirmed receipt to support."},
    )
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "COMPLETED"
    assert result.json()["resolved_by"] is not None
    assert result.json()["resolution_reason"] == "Both participants confirmed receipt to support."
    again = await client.post(
        f"/api/v1/exchanges/{e['id']}/resolve",
        headers=admin,
        json={"decision": "COMPLETE", "reason": "Repeated resolution should not transfer again."},
    )
    assert again.status_code == 409


async def test_proposals_require_verified_same_campus_students(client, students, campuses):
    headers = await signup(client, "unverified@example.com")
    await setup(client, headers, campuses[0])
    response = await client.post(
        "/api/v1/exchanges",
        headers=headers,
        json={
            "requested_listing_id": students[1][1]["id"],
            "offered_listing_id": students[0][1]["id"],
        },
    )
    assert response.status_code == 422  # Cannot offer another user's listing.
    # A verified participant selecting a different campus loses eligibility and
    # their former listings are archived atomically.
    changed = await client.put(
        "/api/v1/users/me/profile",
        headers=students[0][0],
        json={
            "display_name": "Student",
            "campus_id": str(campuses[1]),
        },
    )
    assert changed.status_code == 200
    response = await client.post(
        "/api/v1/exchanges",
        headers=students[0][0],
        json={
            "requested_listing_id": students[1][1]["id"],
            "offered_listing_id": students[0][1]["id"],
        },
    )
    assert response.status_code == 404
