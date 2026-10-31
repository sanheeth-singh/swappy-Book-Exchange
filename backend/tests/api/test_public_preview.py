from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import select

from app.modules.books.models import BookListing, BookPhoto, PhysicalBook
from app.modules.colleges.models import Campus, Membership
from app.modules.exchanges.models import Exchange
from app.modules.users.models import User
from tests.api.test_books import PAYLOAD
from tests.api.test_exchanges import action, propose


async def permission(client, headers, bid, value):
    return await client.patch(
        f"/api/v1/books/{bid}/public-preview", headers=headers, json={"allow_public_preview": value}
    )


async def preview(client, **params):
    response = await client.get("/api/v1/public/books", params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def test_default_private_then_opt_in_minimal_public_card_and_first_cover(
    client, students, session_factory
):
    assert (await preview(client))["items"] == []
    bid = students[0][1]["id"]
    async with session_factory() as session:
        session.add_all(
            [
                BookPhoto(
                    book_id=UUID(bid),
                    file_id="first",
                    url="https://example.com/cover.jpg",
                    created_at=datetime.now(UTC) - timedelta(minutes=1),
                ),
                BookPhoto(book_id=UUID(bid), file_id="second", url="https://example.com/other.jpg"),
            ]
        )
        await session.commit()
    opted_in = await permission(client, students[0][0], bid, True)
    assert opted_in.status_code == 200, opted_in.text
    assert opted_in.json()["is_reserved"] is False
    data = await preview(client)
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert set(item) == {"id", "title", "author", "genre", "condition", "cover_url"}
    assert item["cover_url"] == "https://example.com/cover.jpg"
    assert "owner_id" not in str(data) and "condition_notes" not in str(data)
    # Private detail/profile access remains authenticated.
    assert (await client.get(f"/api/v1/books/{bid}")).status_code == 401
    assert (
        await client.get(f"/api/v1/users/{students[0][1]['owner_id']}/profile")
    ).status_code == 401
    assert (await client.get(f"/api/v1/public/books/{bid}")).status_code == 404


async def test_global_pool_cap_before_search_or_genre_cannot_be_bypassed(
    client, students, session_factory
):
    uid = UUID(students[1][1]["owner_id"])
    campus = UUID(students[1][1]["campus_id"])
    ids = []
    async with session_factory() as session:
        base = datetime.now(UTC) - timedelta(hours=1)
        for i in range(105):
            physical = PhysicalBook(
                owner_id=uid, title=f"Book {i}", author="Writer", genre="ACADEMIC"
            )
            session.add(physical)
            await session.flush()
            row = BookListing(
                physical_book_id=physical.id,
                owner_id=uid,
                campus_id=campus,
                title="Excluded needle" if i < 5 else f"Book {i}",
                author="Writer",
                description="Private",
                condition="GOOD",
                genre="FANTASY" if i < 5 else "ACADEMIC",
                allow_public_preview=True,
                created_at=base + timedelta(seconds=i),
            )
            session.add(row)
            await session.flush()
            ids.append(str(row.id))
        await session.commit()
    seen = []
    for offset in range(0, 100, 20):
        data = await preview(client, offset=offset)
        assert data["total"] == 100
        seen.extend(item["id"] for item in data["items"])
    assert len(seen) == len(set(seen)) == 100
    assert not set(ids[:5]) & set(seen)
    assert seen[0] == ids[-1]
    assert (await preview(client, q="Excluded needle"))["total"] == 0
    assert (await preview(client, genre="FANTASY"))["total"] == 0
    assert (await preview(client, offset=100))["items"] == []


async def test_owner_only_permission_and_create_opt_in(client, students):
    bid = students[0][1]["id"]
    assert (await permission(client, students[1][0], bid, True)).status_code == 404
    response = await client.post(
        "/api/v1/books",
        headers=students[0][0],
        json={**PAYLOAD, "title": "Shared at creation", "allow_public_preview": True},
    )
    assert response.status_code == 201, response.text
    assert response.json()["allow_public_preview"] is True
    assert [item["id"] for item in (await preview(client))["items"]] == [response.json()["id"]]
    # Normal metadata edits preserve a separately managed visibility permission.
    edited = await client.put(
        f"/api/v1/books/{response.json()['id']}", headers=students[0][0], json=PAYLOAD
    )
    assert edited.json()["allow_public_preview"] is True


@pytest.mark.parametrize(
    "state",
    [
        "hidden",
        "archived",
        "restricted",
        "inactive",
        "expired",
        "membership_pending",
        "membership_inactive",
        "campus_inactive",
        "campus_changed",
        "ownership_changed",
    ],
)
async def test_live_preview_eligibility(client, students, session_factory, state):
    bid = students[0][1]["id"]
    uid = UUID(students[0][1]["owner_id"])
    assert (await permission(client, students[0][0], bid, True)).status_code == 200
    async with session_factory() as session:
        book = await session.get(BookListing, UUID(bid))
        user = await session.get(User, uid)
        membership = await session.scalar(select(Membership).where(Membership.user_id == uid))
        if state == "hidden":
            book.is_hidden = True
        elif state == "archived":
            book.is_archived = True
        elif state == "restricted":
            user.is_participation_restricted = True
        elif state == "inactive":
            user.is_active = False
        elif state == "expired":
            membership.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif state == "membership_pending":
            membership.status = "PENDING"
        elif state == "membership_inactive":
            membership.active = False
        elif state == "campus_inactive":
            campus = await session.get(Campus, user.campus_id)
            campus.is_active = False
        elif state == "campus_changed":
            user.campus_id = None
        else:
            physical = await session.get(PhysicalBook, book.physical_book_id)
            physical.owner_id = UUID(students[1][1]["owner_id"])
        await session.commit()
    assert (await preview(client))["items"] == []


async def test_reservation_hides_preview_and_consent_does_not_cancel_proposals(
    client, students, session_factory
):
    row = await propose(client, students)
    bid = students[0][1]["id"]
    assert (await permission(client, students[0][0], bid, True)).status_code == 200
    async with session_factory() as session:
        exchange = await session.get(Exchange, UUID(row["id"]))
        assert exchange.status == "PENDING"
    assert len((await preview(client))["items"]) == 1
    await action(client, students[1][0], row["id"], "accept")
    assert (await preview(client))["items"] == []
    withdrawn = await permission(client, students[0][0], bid, False)
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["is_reserved"] is True
    assert withdrawn.json()["allow_public_preview"] is False


@pytest.mark.parametrize(
    "state", ["hidden", "archived", "expired", "restricted", "campus_inactive"]
)
async def test_withdrawal_available_after_publication_eligibility_lost(
    client, students, session_factory, state
):
    bid = students[0][1]["id"]
    uid = UUID(students[0][1]["owner_id"])
    await permission(client, students[0][0], bid, True)
    async with session_factory() as session:
        user = await session.get(User, uid)
        book = await session.get(BookListing, UUID(bid))
        if state == "hidden":
            book.is_hidden = True
        elif state == "archived":
            book.is_archived = True
        elif state == "expired":
            membership = await session.scalar(select(Membership).where(Membership.user_id == uid))
            membership.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif state == "restricted":
            user.is_participation_restricted = True
        else:
            campus = await session.get(Campus, user.campus_id)
            campus.is_active = False
        await session.commit()
    response = await permission(client, students[0][0], bid, False)
    assert response.status_code == 200, response.text
    assert response.json()["allow_public_preview"] is False


async def test_publication_is_public_even_for_a_personal_block(client, students):
    bid = students[0][1]["id"]
    await permission(client, students[0][0], bid, True)
    await client.post(f"/api/v1/blocks/{students[0][1]['owner_id']}", headers=students[1][0])
    assert (await client.get(f"/api/v1/books/{bid}", headers=students[1][0])).status_code == 404
    assert [item["id"] for item in (await preview(client))["items"]] == [bid]
