from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect

from app.modules.books.genres import GENRE_LABELS, Genre, genres_from_interests
from app.modules.books.recommendations import candidate_query, history_query, recommend
from app.modules.books.schemas import BookInput, BookResponse

BASE = {"title": "Book", "author": "Writer", "description": "Copy", "condition": "GOOD"}


@pytest.mark.parametrize("genre", [None, "", "Fantasy", "UNCLASSIFIED", 4])
def test_invalid_genres_are_rejected(genre):
    with pytest.raises(ValidationError):
        BookInput(**BASE, genre=genre)


def test_new_writes_require_genre_but_legacy_snapshots_remain_readable():
    with pytest.raises(ValidationError):
        BookInput(**BASE)
    data = {
        **BASE,
        "id": uuid4(),
        "physical_book_id": uuid4(),
        "owner_id": uuid4(),
        "campus_id": uuid4(),
        "is_archived": True,
        "is_reserved": False,
        "photos": [],
    }
    assert BookResponse(**data).genre is None
    assert BookInput(**BASE, genre="FANTASY").genre == Genre.FANTASY
    assert len(GENRE_LABELS) == len(Genre) == 20


def test_reading_interests_are_exact_known_hints_not_arbitrary_classification():
    assert genres_from_interests([" Sci-Fi ", "History", "history", "Fantasy novels", "Other"]) == {
        Genre.SCIENCE_FICTION,
        Genre.HISTORY,
    }
    assert genres_from_interests(["Coffee", "Anything I enjoy"]) == set()


@pytest.mark.parametrize("genres", [set(), {Genre.FANTASY, Genre.HISTORY}])
def test_query_compiles_with_safe_limit_and_deterministic_order(genres):
    actor = SimpleNamespace(id=uuid4(), campus_id=uuid4())
    statement = candidate_query(actor, genres, datetime.now(UTC))
    compiled = statement.compile(dialect=dialect(), compile_kwargs={"literal_binds": True})
    sql = str(compiled)
    assert "LIMIT 5" in sql
    assert "book_listings.created_at DESC, book_listings.id DESC" in sql
    assert "memberships.expires_at" in sql and "book_reservations" in sql
    assert "user_blocks" in sql and "physical_books.owner_id" in sql
    assert "exchanges.status" in sql
    assert "row_number() OVER" in str(history_query(actor.id).compile(dialect=dialect()))


@pytest.mark.parametrize(
    "history,interests,expected_sources",
    [
        ([], [], []),
        ([None, "OTHER"], ["Tea"], []),
        (["FANTASY", "FANTASY"], [], ["LISTING_HISTORY"]),
        ([], ["History"], ["READING_INTERESTS"]),
        (["FANTASY"], ["Sci-fi"], ["LISTING_HISTORY", "READING_INTERESTS"]),
    ],
)
async def test_preference_sources_and_read_only_response(history, interests, expected_sources):
    session = AsyncMock()
    session.scalars.side_effect = [
        Mock(all=Mock(return_value=history)),
        Mock(all=Mock(return_value=[])),
    ]
    actor = SimpleNamespace(id=uuid4(), campus_id=uuid4(), reading_interests=interests)
    result = await recommend(session, actor)
    assert result.items == []
    assert result.preference_sources == expected_sources
    assert Genre.OTHER not in result.preferred_genres
    session.commit.assert_not_awaited()


async def test_response_distinguishes_matches_from_recent_fallback():
    def row(genre):
        return SimpleNamespace(
            **BASE,
            genre=genre,
            id=uuid4(),
            physical_book_id=uuid4(),
            owner_id=uuid4(),
            campus_id=uuid4(),
            is_archived=False,
            is_reserved=False,
            is_hidden=False,
            condition_notes="",
            photos=[],
        )

    session = AsyncMock()
    session.scalars.side_effect = [
        Mock(all=Mock(return_value=["FANTASY"])),
        Mock(all=Mock(return_value=[row("FANTASY"), row("HISTORY"), row(None)])),
    ]
    result = await recommend(
        session, SimpleNamespace(id=uuid4(), campus_id=uuid4(), reading_interests=[])
    )
    assert [item.reason for item in result.items] == [
        "GENRE_MATCH",
        "RECENT_AVAILABLE",
        "RECENT_AVAILABLE",
    ]
    assert result.items[-1].book.genre is None
