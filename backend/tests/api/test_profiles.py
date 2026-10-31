import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import func, select

from app.modules.auth.models import LoginSession
from app.modules.books.models import BookListing, PhysicalBook
from app.modules.colleges.models import Membership
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.service import expire_batch
from app.modules.users.models import User
from tests.api.test_exchanges import action, propose
from tests.api.test_onboarding import signup

PASSWORD = "A-strong-password-123"


async def deactivate(client, headers, password=PASSWORD):
    return await client.post(
        "/api/v1/users/me/deactivate", headers=headers, json={"current_password": password}
    )


async def test_combined_profile_public_privacy_and_membership(client, students, session_factory):
    uid = students[0][1]["owner_id"]
    response = await client.get(f"/api/v1/users/{uid}/profile", headers=students[1][0])
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["membership_verified"] and not data["is_self"]
    assert data["metrics"]["active_listings"] == 1
    assert data["metrics"]["completed_exchanges"] == 0
    assert data["metrics"]["average_rating"] is None and data["metrics"]["trust_score"] is None
    assert data["campus"]["college_name"] == "Test College"
    assert not (
        {"email", "hashed_password", "is_admin", "is_participation_restricted"} & data.keys()
    )
    assert data["avatar_id"] == "reader_01"
    assert (await client.get("/api/v1/users/me/profile", headers=students[0][0])).json()["is_self"]
    async with session_factory() as session:
        membership = await session.scalar(select(Membership).where(Membership.user_id == UUID(uid)))
        membership.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
    assert not (await client.get(f"/api/v1/users/{uid}/profile", headers=students[1][0])).json()[
        "membership_verified"
    ]


async def test_public_edits_do_not_touch_campus_or_membership_even_while_exchanging(
    client, students
):
    eid = (await propose(client, students))["id"]
    await action(client, students[1][0], eid, "accept")
    before = (await client.get("/api/v1/membership/me", headers=students[0][0])).json()
    response = await client.patch(
        "/api/v1/users/me/profile",
        headers=students[0][0],
        json={
            "display_name": "Reader Ben",
            "bio": " Books and tea ",
            "reading_interests": [" History ", "history", "Fantasy"],
            "avatar_id": "reader_12",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["reading_interests"] == ["History", "Fantasy"]
    assert response.json()["bio"] == "Books and tea"
    assert (await client.get("/api/v1/membership/me", headers=students[0][0])).json() == before
    public = (
        await client.get(
            f"/api/v1/users/{students[0][1]['owner_id']}/profile", headers=students[1][0]
        )
    ).json()
    assert public["display_name"] == "Reader Ben" and public["avatar_id"] == "reader_12"
    assert public["membership_verified"]
    assert (
        await client.patch(
            "/api/v1/users/me/profile",
            headers=students[0][0],
            json={"bio": None, "reading_interests": []},
        )
    ).status_code == 200


async def test_profile_books_obey_visibility_and_counts(client, students, session_factory):
    uid = students[0][1]["owner_id"]
    url = f"/api/v1/users/{uid}"
    response = await client.get(url + "/books?limit=1", headers=students[1][0])
    assert response.status_code == 200 and len(response.json()["items"]) == 1
    async with session_factory() as session:
        book = await session.get(BookListing, UUID(students[0][1]["id"]))
        book.is_hidden = True
        await session.commit()
    assert (await client.get(url + "/books", headers=students[1][0])).json()["items"] == []
    assert (await client.get(url + "/profile", headers=students[1][0])).json()["metrics"][
        "active_listings"
    ] == 0
    async with session_factory() as session:
        book = await session.get(BookListing, UUID(students[0][1]["id"]))
        book.is_hidden = False
        user = await session.get(User, UUID(uid))
        user.is_participation_restricted = True
        await session.commit()
    assert (await client.get(url + "/books", headers=students[1][0])).json()["items"] == []


async def test_profile_campus_and_blocks_do_not_leak_books(client, students, campuses):
    uid = students[0][1]["owner_id"]
    await client.put(
        "/api/v1/users/me/profile",
        headers=students[2][0],
        json={"display_name": "Other campus", "campus_id": str(campuses[1])},
    )
    for suffix in ("profile", "books"):
        assert (
            await client.get(f"/api/v1/users/{uid}/{suffix}", headers=students[2][0])
        ).status_code == 404
    await client.post(f"/api/v1/blocks/{uid}", headers=students[1][0])
    for who, target in ((1, uid), (0, students[1][1]["owner_id"])):
        assert (
            await client.get(f"/api/v1/users/{target}/profile", headers=students[who][0])
        ).status_code == 404
        assert (
            await client.get(f"/api/v1/users/{target}/books", headers=students[who][0])
        ).status_code == 404


@pytest.mark.parametrize(
    "who,state", [(0, "PENDING"), (1, "PENDING"), (0, "ACCEPTED"), (1, "WAITING_CONFIRMATION")]
)
async def test_unsettled_exchanges_block_deactivation(client, students, who, state):
    eid = (await propose(client, students))["id"]
    if state != "PENDING":
        await action(client, students[1][0], eid, "accept")
    if state == "WAITING_CONFIRMATION":
        await action(client, students[0][0], eid, "confirm")
    eligibility = (
        await client.get("/api/v1/users/me/deactivation", headers=students[who][0])
    ).json()
    assert not eligibility["can_deactivate"]
    assert (await deactivate(client, students[who][0])).status_code == 409
    assert (await client.get("/api/v1/users/me", headers=students[who][0])).status_code == 200


@pytest.mark.parametrize("ending", ["reject", "cancel", "expire", "complete"])
async def test_deactivation_preserves_terminal_history_and_denies_new_requests(
    client, students, session_factory, ending
):
    eid = (await propose(client, students))["id"]
    if ending == "reject":
        await action(client, students[1][0], eid, "reject")
    elif ending == "cancel":
        await action(client, students[0][0], eid, "cancel")
    else:
        await action(client, students[1][0], eid, "accept")
        if ending == "complete":
            await action(client, students[0][0], eid, "confirm")
            await action(client, students[1][0], eid, "confirm")
        else:
            async with session_factory() as session:
                row = await session.get(Exchange, UUID(eid))
                row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
                await session.commit()
                await expire_batch(session)
    uid = UUID(students[0][1]["owner_id"])
    assert (await deactivate(client, students[0][0])).status_code == 200
    assert (await client.get("/api/v1/users/me", headers=students[0][0])).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/token", data={"username": "student0@example.com", "password": PASSWORD}
        )
    ).status_code == 401
    assert (
        await client.get(f"/api/v1/users/{uid}/profile", headers=students[1][0])
    ).status_code == 404
    async with session_factory() as session:
        user = await session.get(User, uid)
        assert not user.is_active and user.deactivated_at is not None
        assert await session.get(Exchange, UUID(eid)) is not None
        assert await session.scalar(select(func.count()).select_from(PhysicalBook)) >= 3
        assert (
            await session.scalar(
                select(func.count())
                .select_from(LoginSession)
                .where(LoginSession.user_id == uid, LoginSession.revoked_at.is_(None))
            )
            == 0
        )
        assert (
            await session.scalar(
                select(func.count())
                .select_from(BookListing)
                .where(BookListing.owner_id == uid, BookListing.is_archived.is_(False))
            )
            == 0
        )
    # Even an archived direct listing ID cannot be used to send a new proposal.
    response = await client.post(
        "/api/v1/exchanges",
        headers=students[2][0],
        json={
            "requested_listing_id": students[0][1]["id"],
            "offered_listing_id": students[2][1]["id"],
        },
    )
    assert response.status_code in (403, 409)


async def test_password_change_reauthenticates_and_revokes_every_session(client, students):
    second = await client.post(
        "/api/v1/auth/token", data={"username": "student0@example.com", "password": PASSWORD}
    )
    other_headers = {"Authorization": "Bearer " + second.json()["access_token"]}
    wrong = await client.post(
        "/api/v1/users/me/password",
        headers=students[0][0],
        json={
            "current_password": "wrong password",
            "new_password": "A-different-strong-password-456",
        },
    )
    assert wrong.status_code == 403
    assert (await client.get("/api/v1/users/me", headers=other_headers)).status_code == 200
    changed = await client.post(
        "/api/v1/users/me/password",
        headers=students[0][0],
        json={"current_password": PASSWORD, "new_password": "A-different-strong-password-456"},
    )
    assert changed.status_code == 204
    for headers in (students[0][0], other_headers):
        assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/token", data={"username": "student0@example.com", "password": PASSWORD}
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/token",
            data={
                "username": "student0@example.com",
                "password": "A-different-strong-password-456",
            },
        )
    ).status_code == 200


async def test_empty_account_can_deactivate_and_wrong_password_does_not_mutate(client):
    headers = await signup(client, "empty@example.com")
    assert (await client.get("/api/v1/users/me/deactivation", headers=headers)).json()[
        "can_deactivate"
    ]
    assert (await deactivate(client, headers, "wrong")).status_code == 403
    assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 200
    assert (await deactivate(client, headers)).status_code == 200


async def test_deactivation_rolls_back_if_session_revocation_fails(
    client, students, session_factory, monkeypatch
):
    from app.modules.users import account

    async def fail(*args, **kwargs):
        raise RuntimeError("revocation failed")

    monkeypatch.setattr(account, "revoke_all", fail)
    with pytest.raises(RuntimeError):
        await deactivate(client, students[0][0])
    async with session_factory() as session:
        user = await session.get(User, UUID(students[0][1]["owner_id"]))
        assert user.is_active and user.deactivated_at is None
        book = await session.get(BookListing, UUID(students[0][1]["id"]))
        assert not book.is_archived


async def test_concurrent_proposal_and_deactivation_cannot_leave_inactive_active_exchange(
    client, students, session_factory
):
    async def proposal():
        return await client.post(
            "/api/v1/exchanges",
            headers=students[1][0],
            json={
                "requested_listing_id": students[0][1]["id"],
                "offered_listing_id": students[1][1]["id"],
            },
        )

    responses = await asyncio.wait_for(
        asyncio.gather(proposal(), deactivate(client, students[0][0])), timeout=20
    )
    assert responses[0].status_code == 201 or responses[1].status_code == 200
    async with session_factory() as session:
        uid = UUID(students[0][1]["owner_id"])
        user = await session.get(User, uid)
        pending = await session.scalar(
            select(func.count())
            .select_from(Exchange)
            .where(Exchange.owner_id == uid, Exchange.status == "PENDING")
        )
        assert user.is_active or pending == 0


async def test_profile_book_pagination_and_reserved_listing_counts(client, students):
    from tests.api.test_books import PAYLOAD

    uid = students[0][1]["owner_id"]
    for title in ("Second book", "Third book"):
        assert (
            await client.post(
                "/api/v1/books", headers=students[0][0], json={**PAYLOAD, "title": title}
            )
        ).status_code == 201
    eid = (await propose(client, students))["id"]
    await action(client, students[1][0], eid, "accept")
    page = (await client.get(f"/api/v1/users/{uid}/books?limit=2", headers=students[1][0])).json()
    assert len(page["items"]) == 2 and page["next_cursor"] is not None
    older = (
        await client.get(
            f"/api/v1/users/{uid}/books?before={page['next_cursor']}", headers=students[1][0]
        )
    ).json()
    assert len(older["items"]) == 1
    assert not ({b["id"] for b in page["items"]} & {b["id"] for b in older["items"]})
    assert (await client.get(f"/api/v1/users/{uid}/profile", headers=students[1][0])).json()[
        "metrics"
    ]["active_listings"] == 3
    assert (
        await client.get(
            f"/api/v1/users/{students[1][1]['owner_id']}/books?before={page['next_cursor']}",
            headers=students[0][0],
        )
    ).status_code == 404


async def test_deactivation_disables_refresh_and_erases_pending_proof(
    client, campuses, session_factory
):
    from tests.api.test_onboarding import proof, setup

    headers = await signup(client, "leaving@example.com")
    await setup(client, headers, campuses[0])
    await client.post("/api/v1/membership/submissions", headers=headers, files=proof())
    login = await client.post(
        "/api/v1/auth/token", data={"username": "leaving@example.com", "password": PASSWORD}
    )
    raw = login.cookies.get("swappy_refresh")
    csrf = login.json()["csrf_token"]
    assert raw is not None
    assert (await deactivate(client, headers)).status_code == 200
    response = await client.post(
        "/api/v1/auth/refresh", headers={"Cookie": f"swappy_refresh={raw}", "X-CSRF-Token": csrf}
    )
    assert response.status_code == 401
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == "leaving@example.com"))
        membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
        document = await session.scalar(
            select(Membership.document).where(Membership.user_id == user.id)
        )
        assert document is None and not membership.active
        assert membership.status == "NOT_SUBMITTED" and membership.submission_id is None
