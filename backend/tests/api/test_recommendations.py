from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import select

from app.modules.books.models import BookListing, PhysicalBook
from app.modules.colleges.models import Membership
from app.modules.users.models import User
from tests.api.test_books import PAYLOAD
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import setup, signup


async def create(client, headers, title, genre):
    result = await client.post(
        "/api/v1/books", headers=headers, json={**PAYLOAD, "title": title, "genre": genre}
    )
    assert result.status_code == 201, result.text
    return result.json()


async def recommendations(client, headers):
    response = await client.get("/api/v1/books/recommendations", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_required_genre_round_trip_filter_and_catalog(client, students, session_factory):
    missing = {k: v for k, v in PAYLOAD.items() if k != "genre"}
    assert (
        await client.post("/api/v1/books", headers=students[0][0], json=missing)
    ).status_code == 422
    assert (
        await client.put(
            f"/api/v1/books/{students[0][1]['id']}", headers=students[0][0], json=missing
        )
    ).status_code == 422
    created = await create(client, students[0][0], "Fantasy book", "FANTASY")
    assert created["genre"] == "FANTASY"
    async with session_factory() as session:
        physical = await session.get(PhysicalBook, UUID(created["physical_book_id"]))
        assert physical.genre == "FANTASY"
    response = await client.get("/api/v1/books?genre=FANTASY", headers=students[1][0])
    assert [row["id"] for row in response.json()] == [created["id"]]
    catalog = await client.get("/api/v1/books/genres", headers=students[0][0])
    assert catalog.status_code == 200 and len(catalog.json()) == 20
    assert (
        await client.get("/api/v1/books?genre=madeup", headers=students[0][0])
    ).status_code == 422


async def test_matching_genres_before_newer_fallback_and_cap_five(
    client, students, session_factory
):
    changed = await client.put(
        f"/api/v1/books/{students[2][1]['id']}",
        headers=students[2][0],
        json={**PAYLOAD, "genre": "ROMANCE"},
    )
    assert changed.status_code == 200
    matching = []
    for i in range(3):
        matching.append(await create(client, students[1][0], f"Academic {i}", "ACADEMIC"))
    for i in range(6):
        await create(client, students[1][0], f"Recent romance {i}", "ROMANCE")
    result = await recommendations(client, students[0][0])
    assert len(result["items"]) == 5
    # Four academic matches include the owner's original fixture book, before any romance.
    assert [item["reason"] for item in result["items"]] == ["GENRE_MATCH"] * 4 + [
        "RECENT_AVAILABLE"
    ]
    assert result["items"][0]["book"]["id"] == matching[-1]["id"]
    assert all(item["book"]["owner_id"] != students[0][1]["owner_id"] for item in result["items"])
    again = await recommendations(client, students[0][0])
    assert result == again


async def test_cold_start_uses_exact_profile_interests_then_recent_books(
    client, students, campuses
):
    user = await signup(client, "new-reader@example.com")
    await setup(client, user, campuses[0])
    fantasy = await create(client, students[1][0], "Fantasy", "FANTASY")
    await create(client, students[1][0], "Newer romance", "ROMANCE")
    await client.patch(
        "/api/v1/users/me/profile", headers=user, json={"reading_interests": ["Fantasy", "Coffee"]}
    )
    result = await recommendations(client, user)
    assert result["preference_sources"] == ["READING_INTERESTS"]
    assert result["items"][0]["book"]["id"] == fantasy["id"]
    assert result["items"][0]["reason"] == "GENRE_MATCH"
    await client.patch("/api/v1/users/me/profile", headers=user, json={"reading_interests": []})
    result = await recommendations(client, user)
    assert result["preferred_genres"] == []
    assert all(item["reason"] == "RECENT_AVAILABLE" for item in result["items"])


@pytest.mark.parametrize(
    "state",
    [
        "hidden",
        "archived",
        "restricted",
        "inactive",
        "membership_expired",
        "membership_inactive",
        "membership_pending",
        "campus_changed",
    ],
)
async def test_visibility_and_owner_eligibility_exclusions(
    client, students, session_factory, state
):
    uid = UUID(students[1][1]["owner_id"])
    bid = students[1][1]["id"]
    async with session_factory() as session:
        book = await session.get(BookListing, UUID(bid))
        owner = await session.get(User, uid)
        membership = await session.scalar(select(Membership).where(Membership.user_id == uid))
        if state == "hidden":
            book.is_hidden = True
        elif state == "archived":
            book.is_archived = True
        elif state == "restricted":
            owner.is_participation_restricted = True
        elif state == "inactive":
            owner.is_active = False
        elif state == "membership_expired":
            membership.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif state == "membership_inactive":
            membership.active = False
        elif state == "membership_pending":
            membership.status = "PENDING"
        else:
            owner.campus_id = None
        await session.commit()
    result = await recommendations(client, students[0][0])
    assert bid not in [item["book"]["id"] for item in result["items"]]


@pytest.mark.parametrize("blocker", [0, 1])
async def test_either_direction_block_excluded(client, students, blocker):
    target = 1 if blocker == 0 else 0
    await client.post(
        f"/api/v1/blocks/{students[target][1]['owner_id']}", headers=students[blocker][0]
    )
    result = await recommendations(client, students[0][0])
    assert students[1][1]["id"] not in [item["book"]["id"] for item in result["items"]]


async def test_pending_requests_and_reservations_excluded(client, students):
    eid = (await propose(client, students))["id"]
    result = await recommendations(client, students[0][0])
    assert students[1][1]["id"] not in [item["book"]["id"] for item in result["items"]]
    await action(client, students[1][0], eid, "accept")
    result = await recommendations(client, students[2][0])
    ids = [item["book"]["id"] for item in result["items"]]
    assert students[0][1]["id"] not in ids and students[1][1]["id"] not in ids


async def test_archived_history_still_supplies_genre_and_unknown_old_books_are_safe(
    client, students, session_factory
):
    async with session_factory() as session:
        own = await session.get(BookListing, UUID(students[0][1]["id"]))
        own.is_archived = True
        old = await session.get(BookListing, UUID(students[1][1]["id"]))
        old.genre = None
        physical = await session.get(PhysicalBook, old.physical_book_id)
        physical.genre = None
        await session.commit()
    result = await recommendations(client, students[0][0])
    assert result["preferred_genres"] == ["ACADEMIC"]
    old_item = next(item for item in result["items"] if item["book"]["id"] == students[1][1]["id"])
    assert old_item["reason"] == "RECENT_AVAILABLE" and old_item["book"]["genre"] is None
    # An old listing can be corrected with a required real genre; physical metadata follows.
    changed = await client.put(
        f"/api/v1/books/{students[1][1]['id']}",
        headers=students[1][0],
        json={**PAYLOAD, "genre": "FANTASY"},
    )
    assert changed.status_code == 200 and changed.json()["genre"] == "FANTASY"


async def test_campus_empty_result_and_auth_guards(client, students, campuses):
    user = await signup(client, "empty-campus@example.com")
    assert (await client.get("/api/v1/books/recommendations", headers=user)).status_code == 403
    await setup(client, user, campuses[1])
    # This campus has no eligible verified publisher.
    assert (await recommendations(client, user))["items"] == []
    await client.post("/api/v1/auth/logout-all", headers=user)
    assert (await client.get("/api/v1/books/recommendations", headers=user)).status_code == 401


async def test_relisting_same_physical_copy_uses_latest_classification_once(client, students):
    original = students[0][1]
    await client.post(f"/api/v1/books/{original['id']}/archive", headers=students[0][0])
    response = await client.post(
        "/api/v1/books",
        headers=students[0][0],
        json={**PAYLOAD, "genre": "FANTASY", "physical_book_id": original["physical_book_id"]},
    )
    assert response.status_code == 201, response.text
    result = await recommendations(client, students[0][0])
    assert result["preferred_genres"] == ["FANTASY"]


async def test_current_physical_ownership_is_rechecked_for_candidates(
    client, students, session_factory
):
    async with session_factory() as session:
        physical = await session.get(PhysicalBook, UUID(students[1][1]["physical_book_id"]))
        physical.owner_id = UUID(students[0][1]["owner_id"])
        await session.commit()
    result = await recommendations(client, students[0][0])
    assert students[1][1]["id"] not in [item["book"]["id"] for item in result["items"]]


async def test_completed_giveaway_copy_not_recommended_back_after_relisting(client, students):
    eid = (await propose(client, students))["id"]
    for who, verb in ((1, "accept"), (0, "confirm"), (1, "confirm")):
        assert (await action(client, students[who][0], eid, verb)).status_code == 200
    relisted = await client.post(
        "/api/v1/books",
        headers=students[1][0],
        json={**PAYLOAD, "physical_book_id": students[0][1]["physical_book_id"]},
    )
    assert relisted.status_code == 201, relisted.text
    result = await recommendations(client, students[0][0])
    assert relisted.json()["id"] not in [item["book"]["id"] for item in result["items"]]
