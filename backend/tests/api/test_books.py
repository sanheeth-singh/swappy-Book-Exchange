from unittest.mock import AsyncMock

from sqlalchemy import select

from app.modules.books.storage import get_image_storage
from app.modules.colleges.models import Membership
from app.modules.users.models import User
from tests.api.test_onboarding import proof, setup, signup

PAYLOAD = {
    "title": "Database Systems",
    "author": "Author",
    "description": "Study copy",
    "condition": "GOOD",
    "genre": "ACADEMIC",
    "condition_notes": "Notes on two pages",
}


async def verify(session_factory, email, campus):
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == email))
        membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
        membership.status = "VERIFIED"
        membership.active = True
        membership.campus_id = campus
        await session.commit()


async def test_unverified_cannot_create_or_forge_owner(client, campuses):
    headers = await signup(client)
    await setup(client, headers, campuses[0])
    response = await client.post("/api/v1/books", headers=headers, json=PAYLOAD)
    assert response.status_code == 403
    response = await client.post(
        "/api/v1/books", headers=headers, json={**PAYLOAD, "owner_id": str(campuses[0])}
    )
    assert response.status_code == 422


async def test_listing_crud_and_owner_checks(client, campuses, session_factory):
    owner = await signup(client)
    await setup(client, owner, campuses[0])
    await verify(session_factory, "student@example.com", campuses[0])
    created = await client.post("/api/v1/books", headers=owner, json=PAYLOAD)
    assert created.status_code == 201, created.text
    book_id = created.json()["id"]
    stranger = await signup(client, "stranger@example.com")
    await setup(client, stranger, campuses[0])
    await verify(session_factory, "stranger@example.com", campuses[0])
    assert (
        await client.put(f"/api/v1/books/{book_id}", headers=stranger, json=PAYLOAD)
    ).status_code == 404
    edited = await client.put(
        f"/api/v1/books/{book_id}", headers=owner, json={**PAYLOAD, "title": "Updated"}
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Updated"
    assert edited.json()["is_reserved"] is False
    search = await client.get("/api/v1/books?q=Updated", headers=owner)
    assert search.json() == []  # The catalog never includes the viewer's own listings.
    archived = await client.post(f"/api/v1/books/{book_id}/archive", headers=owner)
    assert archived.status_code == 200, archived.text
    assert archived.json()["is_archived"] is True
    assert archived.json()["is_reserved"] is False
    repeated = await client.post(f"/api/v1/books/{book_id}/archive", headers=owner)
    assert repeated.status_code == 200, repeated.text
    assert repeated.json()["is_reserved"] is False
    assert (await client.get(f"/api/v1/books/{book_id}", headers=owner)).status_code == 404
    assert any(
        item["id"] == book_id
        for item in (await client.get("/api/v1/books/me", headers=owner)).json()
    )


async def test_photo_limit_validation_and_no_arbitrary_attachment(
    client, campuses, session_factory
):
    headers = await signup(client)
    await setup(client, headers, campuses[0])
    await verify(session_factory, "student@example.com", campuses[0])
    created = await client.post("/api/v1/books", headers=headers, json=PAYLOAD)
    book_id = created.json()["id"]
    storage = AsyncMock()
    storage.upload.side_effect = [
        (f"file-{i}", f"https://ik.imagekit.io/test/{i}.jpg") for i in range(3)
    ]
    client_app = client._transport.app
    client_app.dependency_overrides[get_image_storage] = lambda: storage
    files = {"photo": proof()["document"]}
    for _ in range(3):
        response = await client.post(
            f"/api/v1/books/{book_id}/photos", headers=headers, files=files
        )
        assert response.status_code == 201, response.text
    assert (
        await client.post(f"/api/v1/books/{book_id}/photos", headers=headers, files=files)
    ).status_code == 409
    assert storage.upload.await_count == 3
    bad = await client.post(
        f"/api/v1/books/{book_id}/photos",
        headers=headers,
        files={"photo": ("fake.jpg", b"fake", "image/jpeg")},
    )
    assert bad.status_code == 422
    detail = await client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert len(detail.json()["photos"]) == 3
    assert "file_id" not in str(detail.json())
