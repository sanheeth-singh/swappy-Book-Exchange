from unittest.mock import AsyncMock

from sqlalchemy import select

from app.modules.books.models import PhotoDeletionTask
from app.modules.books.storage import get_image_storage
from tests.api.test_books import PAYLOAD, verify
from tests.api.test_onboarding import proof, setup, signup


async def test_owner_can_remove_photo_and_reuse_slot(client, campuses, session_factory):
    owner = await signup(client)
    await setup(client, owner, campuses[0])
    await verify(session_factory, "student@example.com", campuses[0])
    book = (await client.post("/api/v1/books", headers=owner, json=PAYLOAD)).json()
    storage = AsyncMock()
    storage.upload.return_value = ("deletion-file", "https://ik.imagekit.io/test/delete.jpg")
    client._transport.app.dependency_overrides[get_image_storage] = lambda: storage
    photo = (
        await client.post(
            f"/api/v1/books/{book['id']}/photos",
            headers=owner,
            files={"photo": proof()["document"]},
        )
    ).json()
    response = await client.delete(
        f"/api/v1/books/{book['id']}/photos/{photo['id']}", headers=owner
    )
    assert response.status_code == 204, response.text
    storage.delete.assert_awaited_once_with("deletion-file")
    assert (await client.get(f"/api/v1/books/{book['id']}", headers=owner)).json()["photos"] == []
    async with session_factory() as session:
        assert await session.scalar(select(PhotoDeletionTask.id)) is None


async def test_failed_storage_cleanup_is_queued_and_stranger_cannot_delete(
    client, campuses, session_factory
):
    owner = await signup(client)
    await setup(client, owner, campuses[0])
    await verify(session_factory, "student@example.com", campuses[0])
    book = (await client.post("/api/v1/books", headers=owner, json=PAYLOAD)).json()
    storage = AsyncMock()
    storage.upload.return_value = ("retry-file", "https://ik.imagekit.io/test/retry.jpg")
    storage.delete.side_effect = RuntimeError("storage unavailable")
    client._transport.app.dependency_overrides[get_image_storage] = lambda: storage
    photo = (
        await client.post(
            f"/api/v1/books/{book['id']}/photos",
            headers=owner,
            files={"photo": proof()["document"]},
        )
    ).json()
    stranger = await signup(client, "stranger@example.com")
    await setup(client, stranger, campuses[0])
    await verify(session_factory, "stranger@example.com", campuses[0])
    assert (
        await client.delete(f"/api/v1/books/{book['id']}/photos/{photo['id']}", headers=stranger)
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/books/{book['id']}/photos/{photo['id']}", headers=owner)
    ).status_code == 204
    async with session_factory() as session:
        task = await session.scalar(select(PhotoDeletionTask))
        assert task.file_id == "retry-file"
        assert task.attempts == 1
