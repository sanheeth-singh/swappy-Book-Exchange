import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.modules.exchanges.models import Exchange
from app.modules.notifications.models import Notification
from app.modules.reviews.models import Review, ReviewModerationAction
from app.modules.reviews.service import publish_batch
from app.modules.users.models import User
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import setup, signup


async def completed(client, students):
    row = await propose(client, students)
    eid = row["id"]
    for who, verb in ((1, "accept"), (0, "confirm"), (1, "confirm")):
        response = await action(client, students[who][0], eid, verb)
        assert response.status_code == 200, response.text
    return eid


async def submit(client, headers, eid, rating=5, comment="Smooth handover"):
    return await client.post(
        f"/api/v1/exchanges/{eid}/reviews",
        headers=headers,
        json={"rating": rating, "comment": comment},
    )


async def reputation(client, headers, uid):
    response = await client.get(f"/api/v1/users/{uid}/reputation", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_reviews_require_completed_participation(client, students):
    row = await propose(client, students)
    assert (await submit(client, students[0][0], row["id"])).status_code == 409
    assert (await submit(client, students[2][0], row["id"])).status_code == 404
    await action(client, students[1][0], row["id"], "accept")
    assert (await submit(client, students[0][0], row["id"])).status_code == 409
    await action(client, students[0][0], row["id"], "confirm")
    assert (await submit(client, students[0][0], row["id"])).status_code == 409


async def test_blind_review_not_leaked_until_both_submit(client, students):
    eid = await completed(client, students)
    first = await submit(client, students[0][0], eid, 1, "Private until published")
    assert first.status_code == 200, first.text
    assert first.json()["published_at"] is None
    peer = (await client.get(f"/api/v1/exchanges/{eid}/reviews", headers=students[1][0])).json()
    assert peer["my_review"] is None and peer["received_review"] is None
    uid = students[1][1]["owner_id"]
    summary = await reputation(client, students[2][0], uid)
    assert summary["review_count"] == 0 and summary["average_rating"] is None
    assert summary["trust_score"] is None
    public = await client.get(f"/api/v1/users/{uid}/reviews", headers=students[2][0])
    assert public.json()["items"] == []
    notices = (await client.get("/api/v1/notifications", headers=students[1][0])).json()["items"]
    assert not any(n["kind"] == "REVIEW_PUBLISHED" for n in notices)
    second = await submit(client, students[1][0], eid, 4)
    assert second.status_code == 200 and second.json()["published_at"] is not None
    peer = (await client.get(f"/api/v1/exchanges/{eid}/reviews", headers=students[1][0])).json()
    assert peer["received_review"]["rating"] == 1
    summary = await reputation(client, students[2][0], uid)
    assert summary["review_count"] == 1 and summary["average_rating"] == 1
    assert summary["completed_exchanges"] == summary["distinct_exchange_partners"] == 1
    assert summary["trust_status"] == "NOT_ENOUGH_HISTORY"
    for i in (0, 1):
        notices = (await client.get("/api/v1/notifications", headers=students[i][0])).json()[
            "items"
        ]
        reviews = [n for n in notices if n["kind"] == "REVIEW_PUBLISHED"]
        assert len(reviews) == 1 and "Private until" not in str(reviews)


async def test_duplicate_retry_immutable_and_no_forgery(client, students, session_factory):
    eid = await completed(client, students)
    a = await submit(client, students[0][0], eid)
    b = await submit(client, students[0][0], eid)
    assert a.json()["id"] == b.json()["id"]
    assert (await submit(client, students[0][0], eid, 1)).status_code == 409
    assert (
        await client.post(
            f"/api/v1/exchanges/{eid}/reviews",
            headers=students[0][0],
            json={"rating": 5, "reviewed_user_id": str(uuid4())},
        )
    ).status_code == 422
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Review)) == 1


async def test_deadline_publication_job_is_idempotent_and_late_submission_denied(
    client, students, session_factory
):
    eid = await completed(client, students)
    await submit(client, students[0][0], eid)
    async with session_factory() as session:
        exchange = await session.get(Exchange, UUID(eid))
        exchange.completed_at = datetime.now(UTC) - timedelta(days=14, seconds=1)
        await session.commit()
        assert await publish_batch(session) == 1
        assert await publish_batch(session) == 0
    assert (await submit(client, students[1][0], eid)).status_code == 409
    # An identical retry returns the existing submission even after the deadline.
    assert (await submit(client, students[0][0], eid)).status_code == 200
    summary = await reputation(client, students[1][0], students[1][1]["owner_id"])
    assert summary["review_count"] == 1


async def test_existing_feedback_rights_survive_block_and_restriction(
    client, students, session_factory
):
    eid = await completed(client, students)
    await client.post(f"/api/v1/blocks/{students[1][1]['owner_id']}", headers=students[0][0])
    async with session_factory() as session:
        user = await session.get(User, UUID(students[0][1]["owner_id"]))
        user.is_participation_restricted = True
        await session.commit()
    assert (await submit(client, students[0][0], eid)).status_code == 200
    assert (await submit(client, students[1][0], eid)).status_code == 200


async def test_concurrent_submissions_and_retries_publish_once(client, students, session_factory):
    eid = await completed(client, students)
    results = await asyncio.wait_for(
        asyncio.gather(
            submit(client, students[0][0], eid),
            submit(client, students[0][0], eid),
            submit(client, students[1][0], eid),
        ),
        timeout=15,
    )
    assert all(r.status_code == 200 for r in results)
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(Review)) == 2
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.kind == "REVIEW_PUBLISHED")
            )
            == 2
        )


async def test_publication_failure_rolls_back_second_review_and_both_notices(
    client, students, session_factory, monkeypatch
):
    from app.modules.reviews import service

    eid = await completed(client, students)
    await submit(client, students[0][0], eid)

    async def fail(*args, **kwargs):
        raise RuntimeError("notification failure")

    monkeypatch.setattr(service, "notify", fail)
    with pytest.raises(RuntimeError):
        await submit(client, students[1][0], eid)
    async with session_factory() as session:
        reviews = list((await session.scalars(select(Review))).all())
        assert len(reviews) == 1 and reviews[0].published_at is None
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.kind == "REVIEW_PUBLISHED")
            )
            == 0
        )


async def test_review_moderation_hidden_from_scores_and_restore_idempotent(
    client, students, session_factory
):
    eid = await completed(client, students)
    a = await submit(client, students[0][0], eid)
    await submit(client, students[1][0], eid)
    rid = a.json()["id"]
    assert (
        await client.post(
            f"/api/v1/moderation/reviews/{rid}",
            headers=students[2][0],
            json={"action": "HIDE", "reason": "Abusive review text."},
        )
    ).status_code == 403
    async with session_factory() as session:
        third = await session.get(User, UUID(students[2][1]["owner_id"]))
        third.is_admin = True
        await session.commit()
    for _ in range(2):
        response = await client.post(
            f"/api/v1/moderation/reviews/{rid}",
            headers=students[2][0],
            json={"action": "HIDE", "reason": "Abusive review text."},
        )
        assert response.status_code == 200, response.text
    summary = await reputation(client, students[1][0], students[1][1]["owner_id"])
    assert summary["review_count"] == 0
    assert summary["completed_exchanges"] == 1
    assert (await client.get(f"/api/v1/exchanges/{eid}/reviews", headers=students[1][0])).json()[
        "received_review"
    ] is None
    for _ in range(2):
        response = await client.post(
            f"/api/v1/moderation/reviews/{rid}",
            headers=students[2][0],
            json={"action": "RESTORE", "reason": "Review re-evaluated."},
        )
        assert response.status_code == 200
    assert (await reputation(client, students[1][0], students[1][1]["owner_id"]))[
        "review_count"
    ] == 1
    audits = (
        await client.get(f"/api/v1/moderation/reviews/{rid}/actions", headers=students[2][0])
    ).json()
    assert len(audits) == 2
    async with session_factory() as session:
        assert await session.scalar(select(func.count()).select_from(ReviewModerationAction)) == 2


async def test_admin_cannot_moderate_own_review_or_peek_at_sealed_review(
    client, students, session_factory
):
    eid = await completed(client, students)
    a = await submit(client, students[0][0], eid)
    async with session_factory() as session:
        user = await session.get(User, UUID(students[0][1]["owner_id"]))
        user.is_admin = True
        await session.commit()
    assert (await client.get("/api/v1/moderation/reviews", headers=students[0][0])).json() == []
    await submit(client, students[1][0], eid)
    assert (
        await client.post(
            f"/api/v1/moderation/reviews/{a.json()['id']}",
            headers=students[0][0],
            json={"action": "HIDE", "reason": "Should be denied."},
        )
    ).status_code == 403


async def test_reputation_campus_access_and_revoked_sessions(client, students, campuses):
    outsider = await signup(client, "othercampus@example.com")
    await setup(client, outsider, campuses[1])
    uid = students[0][1]["owner_id"]
    assert (
        await client.get(f"/api/v1/users/{uid}/reputation", headers=outsider)
    ).status_code == 404
    await completed(client, students)
    changed = await client.put(
        "/api/v1/users/me/profile",
        headers=students[0][0],
        json={"display_name": "Moved student", "campus_id": str(campuses[1])},
    )
    assert changed.status_code == 200, changed.text
    assert (
        await client.get(
            f"/api/v1/users/{students[1][1]['owner_id']}/reputation", headers=students[0][0]
        )
    ).status_code == 200
    await client.post("/api/v1/auth/logout-all", headers=students[0][0])
    assert (
        await client.get(f"/api/v1/users/{uid}/reputation", headers=students[0][0])
    ).status_code == 401


async def seed_review(session, prototype, reviewer, target, rating, *, published=True):
    now = datetime.now(UTC)
    exchange = Exchange(
        requester_id=reviewer,
        owner_id=target,
        campus_id=prototype.campus_id,
        requested_listing_id=prototype.requested_listing_id,
        offered_listing_id=prototype.offered_listing_id,
        requested_snapshot={},
        offered_snapshot={},
        requester_name="Reviewer",
        owner_name="Target",
        status="COMPLETED",
        requester_confirmed=True,
        owner_confirmed=True,
        completed_at=now,
    )
    session.add(exchange)
    await session.flush()
    review = Review(
        exchange_id=exchange.id,
        reviewer_id=reviewer,
        reviewed_user_id=target,
        rating=rating,
        published_at=now if published else None,
    )
    session.add(review)
    return review


async def test_trust_counts_distinct_reviewers_not_repeated_exchanges(
    client, students, session_factory
):
    eid = await completed(client, students)
    uid = UUID(students[1][1]["owner_id"])
    first = UUID(students[0][1]["owner_id"])
    async with session_factory() as session:
        prototype = await session.get(Exchange, UUID(eid))
        for _ in range(8):
            await seed_review(session, prototype, first, uid, 5)
        await session.commit()
    summary = await reputation(client, students[1][0], uid)
    assert summary["review_count"] == 8 and summary["distinct_reviewers"] == 1
    assert summary["trust_score"] is None
    async with session_factory() as session:
        prototype = await session.get(Exchange, UUID(eid))
        for i in range(2):
            user = User(email=f"partner{i}@example.com", hashed_password="unused")
            session.add(user)
            await session.flush()
            await seed_review(session, prototype, user.id, uid, 5)
        await session.commit()
    summary = await reputation(client, students[1][0], uid)
    assert summary["trust_score"] == 68.8
    assert summary["distinct_reviewers"] == 3
    # Another five-star exchange with the first reviewer cannot increase the score.
    async with session_factory() as session:
        prototype = await session.get(Exchange, UUID(eid))
        await seed_review(session, prototype, first, uid, 5)
        await session.commit()
    assert (await reputation(client, students[1][0], uid))["trust_score"] == 68.8
    # Hiding the only review from one independent reviewer removes their contribution.
    async with session_factory() as session:
        admin = await session.get(User, UUID(students[2][1]["owner_id"]))
        admin.is_admin = True
        rid = await session.scalar(
            select(Review.id)
            .where(Review.reviewed_user_id == uid, Review.reviewer_id != first)
            .limit(1)
        )
        await session.commit()
    for action_name, expected in (("HIDE", None), ("RESTORE", 68.8)):
        response = await client.post(
            f"/api/v1/moderation/reviews/{rid}",
            headers=students[2][0],
            json={"action": action_name, "reason": "Independent visibility review."},
        )
        assert response.status_code == 200, response.text
        assert (await reputation(client, students[1][0], uid))["trust_score"] == expected


async def test_public_review_pagination_hides_exchange_details(client, students, session_factory):
    eid = await completed(client, students)
    uid = UUID(students[1][1]["owner_id"])
    async with session_factory() as session:
        prototype = await session.get(Exchange, UUID(eid))
        for _ in range(3):
            await seed_review(session, prototype, UUID(students[0][1]["owner_id"]), uid, 4)
        await session.commit()
    first = (
        await client.get(f"/api/v1/users/{uid}/reviews?limit=2", headers=students[2][0])
    ).json()
    assert len(first["items"]) == 2 and first["next_cursor"] is not None
    assert "exchange_id" not in first["items"][0] and "email" not in first["items"][0]
    second = (
        await client.get(
            f"/api/v1/users/{uid}/reviews?before={first['next_cursor']}", headers=students[2][0]
        )
    ).json()
    assert len(second["items"]) == 1
    assert not ({r["id"] for r in first["items"]} & {r["id"] for r in second["items"]})
    other = students[0][1]["owner_id"]
    assert (
        await client.get(
            f"/api/v1/users/{other}/reviews?before={first['next_cursor']}", headers=students[2][0]
        )
    ).status_code == 404


async def test_concurrent_publication_workers_only_notify_once(client, students, session_factory):
    eid = await completed(client, students)
    await submit(client, students[0][0], eid)
    async with session_factory() as session:
        exchange = await session.get(Exchange, UUID(eid))
        exchange.completed_at = datetime.now(UTC) - timedelta(days=15)
        await session.commit()

    async def work():
        async with session_factory() as session:
            await publish_batch(session)

    await asyncio.wait_for(asyncio.gather(work(), work()), timeout=15)
    async with session_factory() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.kind == "REVIEW_PUBLISHED")
            )
            == 1
        )
