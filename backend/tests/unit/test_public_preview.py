from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect

from app.api.dependencies.database import get_session
from app.main import create_app
from app.modules.books.genres import Genre
from app.modules.books.preview import browse, pool_query
from app.modules.books.preview_schemas import PreviewPermissionInput, PublicBookCard
from app.modules.books.schemas import BookCreate


def card(title, genre="FANTASY"):
    return {
        "id": uuid4(),
        "title": title,
        "author": "A writer",
        "genre": genre,
        "condition": "GOOD",
        "cover_url": None,
        "owner_id": uuid4(),
        "description": "private text",
    }


def database(rows):
    session = AsyncMock()
    session.execute.return_value = Mock(
        mappings=Mock(return_value=Mock(all=Mock(return_value=rows)))
    )
    return session


async def test_cap_precedes_filters_and_paging():
    rows = [card(f"Book {i}", "ACADEMIC") for i in range(100)] + [card("Outside needle")]
    session = database(rows)
    result = await browse(session, 20, 0, "Outside needle", None)
    assert result.items == [] and result.total == 0
    result = await browse(session, 20, 0, None, Genre.FANTASY)
    assert result.total == 0
    result = await browse(session, 20, 80, None, None)
    assert len(result.items) == 20 and result.total == 100 and result.next_offset is None
    result = await browse(session, 20, 100, None, None)
    assert result.items == []
    session.commit.assert_not_awaited()


async def test_literal_search_public_allowlist_and_next_offset():
    session = database([card("100% real"), card("100 percent"), card("Second 100% real")])
    result = await browse(session, 1, 0, "100%", None)
    assert result.total == 2 and result.next_offset == 1
    assert set(result.items[0].model_dump()) == {
        "id",
        "title",
        "author",
        "genre",
        "condition",
        "cover_url",
    }
    result = await browse(session, 20, 0, " A WRITER ", None)
    assert result.total == 3
    result = await browse(session, 20, 0, "   ", None)
    assert result.total == 3


@pytest.mark.parametrize("value", ["true", 1, None])
def test_permission_requires_an_explicit_boolean(value):
    with pytest.raises(ValidationError):
        PreviewPermissionInput(allow_public_preview=value)


def test_existing_payload_default_is_private_and_public_schema_is_independent():
    book = BookCreate(
        title="Title", author="Author", description="Copy", condition="GOOD", genre="FANTASY"
    )
    assert book.allow_public_preview is False
    assert "owner_id" not in PublicBookCard.model_fields
    assert "campus_id" not in PublicBookCard.model_fields
    assert "physical_book_id" not in PublicBookCard.model_fields
    assert "description" not in PublicBookCard.model_fields


def test_query_has_cap_consent_and_live_eligibility_without_visitor_filters():
    sql = str(
        pool_query(datetime.now(UTC)).compile(
            dialect=dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "LIMIT 100" in sql and "allow_public_preview IS true" in sql
    assert "memberships.status" in sql and "campuses.is_active IS true" in sql
    assert "book_reservations" in sql and "physical_books.owner_id" in sql
    assert "book_listings.created_at DESC, book_listings.id DESC" in sql
    assert "book_listings.description" not in sql and "users.email" not in sql


async def test_real_http_endpoint_is_anonymous_and_validates_limits():
    app = create_app()
    session = database([card("A visitor book")])

    async def db():
        yield session

    app.dependency_overrides[get_session] = db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/public/books")
        assert response.status_code == 200, response.text
        assert response.json()["total"] == 1
        assert response.json()["preview_limit"] == 100
        for params in ({"limit": 21}, {"offset": 101}, {"genre": "unknown"}):
            assert (await client.get("/api/v1/public/books", params=params)).status_code == 422
        assert (await client.get("/api/v1/books")).status_code == 401
    operation = app.openapi()["paths"]["/api/v1/public/books"]["get"]
    assert not operation.get("security")


async def test_consent_withdrawal_does_not_require_membership_or_editable_listing(monkeypatch):
    from app.modules.books import preview

    user = SimpleNamespace(id=uuid4(), is_active=True)
    listing = SimpleNamespace(allow_public_preview=True, is_archived=True)
    session = AsyncMock()
    monkeypatch.setattr(preview, "lock_users", AsyncMock(return_value={user.id: user}))
    monkeypatch.setattr(preview, "owned_listing", AsyncMock(return_value=listing))
    monkeypatch.setattr(
        preview, "lock_actor", AsyncMock(side_effect=AssertionError("Should not verify membership"))
    )
    assert await preview.set_permission(session, user, uuid4(), False) is listing
    assert listing.allow_public_preview is False
    session.commit.assert_awaited_once()
