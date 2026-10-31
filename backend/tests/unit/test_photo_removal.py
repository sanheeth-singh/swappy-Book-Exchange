from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.api.v1.books import books
from app.core.errors import DomainError
from app.modules.books import photo_cleanup, service
from app.modules.books.models import PhotoDeletionTask


async def test_catalog_excludes_current_owner_before_pagination():
    actor = SimpleNamespace(id=uuid4(), campus_id=uuid4())
    session = SimpleNamespace(scalars=AsyncMock(return_value=SimpleNamespace(all=lambda: [])))
    await books(user=actor, session=session, limit=12, offset=0, q=None, genre=None)
    sql = str(
        session.scalars.call_args.args[0].compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert f"book_listings.owner_id != '{actor.id}'" in sql
    assert f"book_listings.campus_id = '{actor.campus_id}'" in sql
    assert "LIMIT 12" in sql


async def test_removal_commits_retry_metadata_before_storage_cleanup(monkeypatch):
    actor = SimpleNamespace(id=uuid4(), campus_id=uuid4())
    listing = SimpleNamespace(
        id=uuid4(), campus_id=actor.campus_id, is_hidden=False, is_archived=False
    )
    photo = SimpleNamespace(id=uuid4(), file_id="fixture-file")
    session = SimpleNamespace(
        scalar=AsyncMock(return_value=photo),
        add=MagicMock(),
        delete=AsyncMock(),
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )
    monkeypatch.setattr(service, "lock_actor", AsyncMock(return_value=actor))
    monkeypatch.setattr(service, "owned_listing", AsyncMock(return_value=listing))
    monkeypatch.setattr(service, "require_unreserved", AsyncMock())
    monkeypatch.setattr(service, "reject_pending", AsyncMock())

    async def cleanup(*args):
        session.commit.assert_awaited_once()

    monkeypatch.setattr(photo_cleanup, "process_task", AsyncMock(side_effect=cleanup))
    await service.remove_photo(session, actor, listing.id, photo.id, object())
    queued = session.add.call_args.args[0]
    assert isinstance(queued, PhotoDeletionTask)
    assert queued.file_id == "fixture-file"
    session.delete.assert_awaited_once_with(photo)


async def test_reserved_listing_cannot_remove_photos(monkeypatch):
    actor = SimpleNamespace(id=uuid4(), campus_id=uuid4())
    listing = SimpleNamespace(
        id=uuid4(), campus_id=actor.campus_id, is_hidden=False, is_archived=False
    )
    session = SimpleNamespace(add=MagicMock(), delete=AsyncMock())
    monkeypatch.setattr(service, "lock_actor", AsyncMock(return_value=actor))
    monkeypatch.setattr(service, "owned_listing", AsyncMock(return_value=listing))
    monkeypatch.setattr(
        service,
        "require_unreserved",
        AsyncMock(side_effect=DomainError("book_reserved", "Reserved", 409)),
    )
    with pytest.raises(DomainError):
        await service.remove_photo(session, actor, listing.id, uuid4(), object())
    session.delete.assert_not_awaited()
    session.add.assert_not_called()


async def test_cleanup_failure_retains_work_and_success_removes_it():
    task = SimpleNamespace(file_id="fixture", attempts=0)
    session = SimpleNamespace(
        scalar=AsyncMock(return_value=task), commit=AsyncMock(), delete=AsyncMock()
    )
    storage = SimpleNamespace(delete=AsyncMock(side_effect=RuntimeError("storage offline")))
    assert await photo_cleanup.process_task(session, uuid4(), storage) is False
    assert task.attempts == 1
    session.delete.assert_not_awaited()
    storage.delete.side_effect = None
    assert await photo_cleanup.process_task(session, uuid4(), storage) is True
    session.delete.assert_awaited_once_with(task)
