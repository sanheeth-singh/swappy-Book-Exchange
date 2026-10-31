import asyncio
from uuid import UUID

import pytest
from sqlalchemy import func, select

from app.modules.exchanges.models import Exchange, Reservation
from app.modules.moderation.models import ModerationAction, Report, UserBlock
from app.modules.users.models import User
from tests.api.test_books import PAYLOAD
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import setup, signup


@pytest.fixture
async def admin(client, session_factory):
    headers = await signup(client, "moderator@example.com")
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "moderator@example.com"))
        user.is_admin = True
        await session.commit()
    return headers


async def report_listing(client, reporter, listing):
    result = await client.post(
        "/api/v1/reports",
        headers=reporter,
        json={
            "target_type": "LISTING",
            "listing_id": listing["id"],
            "reason": "MISLEADING_LISTING",
            "details": "Condition does not match the listing.",
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


async def review(client, admin, report_id, decision):
    return await client.post(
        f"/api/v1/moderation/reports/{report_id}/review",
        headers=admin,
        json={
            "action": decision,
            "summary": "Reviewed the submitted details and supporting context.",
        },
    )


async def test_user_report_and_block_work_before_profile_or_verification(
    client, students, session_factory
):
    explorer = await signup(client, "explorer@example.com")
    target = students[1][1]["owner_id"]
    payload = {"target_type": "USER", "target_user_id": target, "reason": "SPAM"}
    result = await client.post("/api/v1/reports", headers=explorer, json=payload)
    assert result.status_code == 201, result.text
    assert "target_snapshot" not in result.json()
    assert "reporter_id" not in result.json()
    assert (await client.post("/api/v1/reports", headers=explorer, json=payload)).status_code == 409
    assert (await client.post(f"/api/v1/blocks/{target}", headers=explorer)).status_code == 200
    async with session_factory() as session:
        user = await session.get(User, UUID(target))
        assert not user.is_participation_restricted
        assert await session.scalar(select(func.count()).select_from(ModerationAction)) == 0


async def test_report_privacy_and_admin_permissions(client, students, admin):
    report = await report_listing(client, students[0][0], students[1][1])
    rid = report["id"]
    for other in [students[1][0], students[2][0]]:
        assert (await client.get(f"/api/v1/reports/{rid}", headers=other)).status_code == 404
        assert (await client.get("/api/v1/reports/me", headers=other)).json() == []
        assert (await client.get("/api/v1/moderation/reports", headers=other)).status_code == 403
        assert (await review(client, other, rid, "HIDE_LISTING")).status_code == 403
    detailed = await client.get(f"/api/v1/moderation/reports/{rid}", headers=admin)
    assert detailed.status_code == 200
    assert detailed.json()["target_snapshot"]["title"] == students[1][1]["title"]
    assert "email" not in str(detailed.json()["target_snapshot"])
    own = await client.get(f"/api/v1/reports/{rid}", headers=students[0][0])
    assert own.status_code == 200
    assert "target_snapshot" not in own.json()


async def test_listing_reports_stay_campus_scoped_but_do_not_require_verification(
    client, campuses, students
):
    explorer = await signup(client, "explorer@example.com")
    await setup(client, explorer, campuses[0])
    await report_listing(client, explorer, students[0][1])
    foreign = await signup(client, "foreign@example.com")
    await setup(client, foreign, campuses[1])
    result = await client.post(
        "/api/v1/reports",
        headers=foreign,
        json={
            "target_type": "LISTING",
            "listing_id": students[0][1]["id"],
            "reason": "SPAM",
        },
    )
    assert result.status_code == 404


async def test_blocking_is_bidirectional_private_and_does_not_revive_old_proposals(
    client, students
):
    pending = await propose(client, students)
    target = students[1][1]["owner_id"]
    caller = students[0][1]["owner_id"]
    for _ in range(2):
        assert (
            await client.post(f"/api/v1/blocks/{target}", headers=students[0][0])
        ).status_code == 200
    assert (await action(client, students[1][0], pending["id"], "accept")).status_code == 409
    for viewer, other in [(0, 1), (1, 0)]:
        detail = await client.get(
            f"/api/v1/books/{students[other][1]['id']}", headers=students[viewer][0]
        )
        assert detail.status_code == 404
        browse = (await client.get("/api/v1/books?q=Book", headers=students[viewer][0])).json()
        assert students[other][1]["id"] not in {b["id"] for b in browse}
    assert len((await client.get("/api/v1/blocks", headers=students[0][0])).json()) == 1
    assert (await client.get("/api/v1/blocks", headers=students[1][0])).json() == []
    # The other direction is a separate preference.
    await client.post(f"/api/v1/blocks/{caller}", headers=students[1][0])
    await client.post(f"/api/v1/blocks/{target}/unblock", headers=students[0][0])
    denied = await client.post(
        "/api/v1/exchanges",
        headers=students[0][0],
        json={
            "requested_listing_id": students[1][1]["id"],
            "offered_listing_id": students[0][1]["id"],
        },
    )
    assert denied.status_code == 403
    await client.post(f"/api/v1/blocks/{caller}/unblock", headers=students[1][0])
    assert (await client.get(f"/api/v1/exchanges/{pending['id']}", headers=students[0][0])).json()[
        "status"
    ] == "REJECTED"
    assert (
        await client.get(f"/api/v1/books/{students[1][1]['id']}", headers=students[0][0])
    ).status_code == 200


async def test_block_preserves_accepted_reservations_and_completion(
    client, students, session_factory
):
    exchange = await propose(client, students)
    await action(client, students[1][0], exchange["id"], "accept")
    await client.post(f"/api/v1/blocks/{students[1][1]['owner_id']}", headers=students[0][0])
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 2
    assert (
        await client.get(f"/api/v1/exchanges/{exchange['id']}", headers=students[1][0])
    ).status_code == 200
    assert (await action(client, students[0][0], exchange["id"], "confirm")).json()["status"] == (
        "WAITING_CONFIRMATION"
    )
    assert (await action(client, students[1][0], exchange["id"], "confirm")).json()["status"] == (
        "COMPLETED"
    )


async def test_hide_listing_is_reversible_and_cannot_be_bypassed_by_owner(client, students, admin):
    pending = await propose(client, students)
    report = await report_listing(client, students[0][0], students[1][1])
    result = await review(client, admin, report["id"], "HIDE_LISTING")
    assert result.status_code == 200, result.text
    assert (await action(client, students[1][0], pending["id"], "accept")).status_code == 409
    assert (
        await client.get(f"/api/v1/books/{students[1][1]['id']}", headers=students[0][0])
    ).status_code == 404
    edit = await client.put(
        f"/api/v1/books/{students[1][1]['id']}", headers=students[1][0], json=PAYLOAD
    )
    assert edit.status_code == 409
    await client.post(f"/api/v1/books/{students[1][1]['id']}/archive", headers=students[1][0])
    relist = await client.post(
        "/api/v1/books",
        headers=students[1][0],
        json={
            **PAYLOAD,
            "physical_book_id": students[1][1]["physical_book_id"],
        },
    )
    assert relist.status_code == 409
    restored = await client.post(
        f"/api/v1/moderation/listings/{students[1][1]['id']}/restore",
        headers=admin,
        json={"reason": "The reported content has been reviewed and cleared."},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["changed"]
    relist = await client.post(
        "/api/v1/books",
        headers=students[1][0],
        json={
            **PAYLOAD,
            "physical_book_id": students[1][1]["physical_book_id"],
        },
    )
    assert relist.status_code == 201, relist.text


async def test_restriction_preserves_existing_handover_and_restoration_is_audited(
    client, students, admin, session_factory
):
    exchange = await propose(client, students)
    await action(client, students[1][0], exchange["id"], "accept")
    target = students[0][1]["owner_id"]
    report = await client.post(
        "/api/v1/reports",
        headers=students[2][0],
        json={
            "target_type": "USER",
            "target_user_id": target,
            "reason": "HARASSMENT",
        },
    )
    result = await review(client, admin, report.json()["id"], "RESTRICT_USER")
    assert result.status_code == 200, result.text
    assert (
        await client.post("/api/v1/books", headers=students[0][0], json=PAYLOAD)
    ).status_code == 403
    assert (await client.get("/api/v1/users/me", headers=students[0][0])).json()[
        "is_participation_restricted"
    ]
    assert (await action(client, students[0][0], exchange["id"], "confirm")).status_code == 200
    assert (await action(client, students[1][0], exchange["id"], "confirm")).json()[
        "status"
    ] == "COMPLETED"
    for expected in [True, False]:
        restored = await client.post(
            f"/api/v1/moderation/users/{target}/restore",
            headers=admin,
            json={"reason": "The restriction has been reviewed and cleared."},
        )
        assert restored.status_code == 200
        assert restored.json()["changed"] is expected
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(ModerationAction)) == 2


async def test_closed_report_cannot_be_reviewed_twice_and_self_review_is_denied(
    client, students, admin, session_factory
):
    report = await report_listing(client, students[0][0], students[1][1])
    async with session_factory() as session:
        reporter = await session.get(User, UUID(students[0][1]["owner_id"]))
        reporter.is_admin = True
        await session.commit()
    assert (await review(client, students[0][0], report["id"], "DISMISS")).status_code == 403
    assert (await review(client, admin, report["id"], "DISMISS")).status_code == 200
    assert (await review(client, admin, report["id"], "HIDE_LISTING")).status_code == 409
    assert (
        await client.get(f"/api/v1/books/{students[1][1]['id']}", headers=students[0][0])
    ).status_code == 200


async def test_concurrent_block_and_accept_preserve_reservation_consistency(
    client, students, session_factory
):
    exchange = await propose(client, students)
    accepted, blocked = await asyncio.wait_for(
        asyncio.gather(
            action(client, students[1][0], exchange["id"], "accept"),
            client.post(f"/api/v1/blocks/{students[1][1]['owner_id']}", headers=students[0][0]),
        ),
        timeout=15,
    )
    assert blocked.status_code == 200, blocked.text
    assert accepted.status_code in (200, 409)
    async with session_factory() as session:
        row = await session.get(Exchange, UUID(exchange["id"]))
        assert row.status == ("ACCEPTED" if accepted.status_code == 200 else "REJECTED")
        assert await session.scalar(select(func.count()).select_from(Reservation)) == (
            2 if row.status == "ACCEPTED" else 0
        )


async def test_concurrent_duplicate_reports_and_blocks_are_serialized(
    client, students, session_factory
):
    target = students[1][1]["owner_id"]
    payload = {"target_type": "USER", "target_user_id": target, "reason": "SPAM"}
    responses = await asyncio.wait_for(
        asyncio.gather(
            *[
                client.post("/api/v1/reports", headers=students[0][0], json=payload)
                for _ in range(2)
            ]
        ),
        timeout=15,
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    blocks = await asyncio.wait_for(
        asyncio.gather(
            *[client.post(f"/api/v1/blocks/{target}", headers=students[0][0]) for _ in range(2)]
        ),
        timeout=15,
    )
    assert all(r.status_code == 200 for r in blocks)
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Report)) == 1
        assert await session.scalar(select(func.count()).select_from(UserBlock)) == 1


async def test_review_failure_rolls_back_hidden_state_report_and_pending_invalidation(
    client, students, admin, session_factory, monkeypatch
):
    from app.modules.books.models import BookListing
    from app.modules.moderation import service

    pending = await propose(client, students)
    report = await report_listing(client, students[0][0], students[1][1])

    async def fail(session):
        await session.flush()
        raise RuntimeError("injected moderation failure")

    with monkeypatch.context() as patch:
        patch.setattr(service, "finish", fail)
        with pytest.raises(RuntimeError, match="injected moderation failure"):
            await review(client, admin, report["id"], "HIDE_LISTING")
    async with session_factory() as session:
        assert not (await session.get(BookListing, UUID(students[1][1]["id"]))).is_hidden
        assert (await session.get(Report, UUID(report["id"]))).status == "OPEN"
        assert (await session.get(Exchange, UUID(pending["id"]))).status == "PENDING"
        assert await session.scalar(select(func.count()).select_from(ModerationAction)) == 0


async def test_hiding_reserved_listing_does_not_release_or_prevent_handover(
    client, students, admin, session_factory
):
    exchange = await propose(client, students)
    await action(client, students[1][0], exchange["id"], "accept")
    report = await report_listing(client, students[0][0], students[1][1])
    assert (await review(client, admin, report["id"], "HIDE_LISTING")).status_code == 200
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Reservation)) == 2
    await action(client, students[0][0], exchange["id"], "confirm")
    assert (await action(client, students[1][0], exchange["id"], "confirm")).json()[
        "status"
    ] == "COMPLETED"
    # A new owner's fresh listing must not inherit the former publisher's content penalty.
    relisted = await client.post(
        "/api/v1/books",
        headers=students[0][0],
        json={
            **PAYLOAD,
            "physical_book_id": students[1][1]["physical_book_id"],
        },
    )
    assert relisted.status_code == 201, relisted.text


async def test_restriction_rejects_pending_and_blocks_both_sides_of_new_proposals(
    client, students, admin
):
    pending = await propose(client, students)
    target = students[0][1]["owner_id"]
    report = await client.post(
        "/api/v1/reports",
        headers=students[2][0],
        json={
            "target_type": "USER",
            "target_user_id": target,
            "reason": "HARASSMENT",
        },
    )
    assert (await review(client, admin, report.json()["id"], "RESTRICT_USER")).status_code == 200
    assert (await client.get(f"/api/v1/exchanges/{pending['id']}", headers=students[0][0])).json()[
        "status"
    ] == "REJECTED"
    assert (
        await client.get(f"/api/v1/books/{students[0][1]['id']}", headers=students[2][0])
    ).status_code == 404
    for proposer, owner in [(0, 2), (2, 0)]:
        response = await client.post(
            "/api/v1/exchanges",
            headers=students[proposer][0],
            json={
                "requested_listing_id": students[owner][1]["id"],
                "offered_listing_id": students[proposer][1]["id"],
            },
        )
        assert response.status_code == 403, response.text


async def test_concurrent_hiding_and_acceptance_never_releases_an_accepted_reservation(
    client, students, admin, session_factory
):
    exchange = await propose(client, students)
    report = await report_listing(client, students[0][0], students[1][1])
    accepted, hidden = await asyncio.wait_for(
        asyncio.gather(
            action(client, students[1][0], exchange["id"], "accept"),
            review(client, admin, report["id"], "HIDE_LISTING"),
        ),
        timeout=15,
    )
    assert hidden.status_code == 200, hidden.text
    assert accepted.status_code in (200, 409), accepted.text
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Reservation)) == (
            2 if accepted.status_code == 200 else 0
        )


async def test_self_targets_and_forged_moderation_flags_are_rejected(client, students):
    caller = students[0][1]["owner_id"]
    assert (
        await client.post(f"/api/v1/blocks/{caller}", headers=students[0][0])
    ).status_code == 422
    assert (
        await client.post(
            "/api/v1/reports",
            headers=students[0][0],
            json={
                "target_type": "USER",
                "target_user_id": caller,
                "reason": "SPAM",
            },
        )
    ).status_code == 422
    assert (
        await client.put(
            f"/api/v1/books/{students[0][1]['id']}",
            headers=students[0][0],
            json={**PAYLOAD, "is_hidden": False},
        )
    ).status_code == 422
    own = (await client.get("/api/v1/users/me", headers=students[0][0])).json()
    assert (
        await client.put(
            "/api/v1/users/me/profile",
            headers=students[0][0],
            json={
                "display_name": "Student",
                "campus_id": own["campus_id"],
                "is_participation_restricted": False,
            },
        )
    ).status_code == 422
