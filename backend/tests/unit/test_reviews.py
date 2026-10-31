from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.reviews.policies import trust_score
from app.modules.reviews.schemas import PublicReview, ReviewInput


@pytest.mark.parametrize("rating", [0, 6, True, 4.5, "5"])
def test_rating_must_be_strict_integer(rating):
    with pytest.raises(ValidationError):
        ReviewInput(rating=rating)


@pytest.mark.parametrize("comment", ["x" * 2001, "bad\x00text"])
def test_reject_invalid_comment(comment):
    with pytest.raises(ValidationError):
        ReviewInput(rating=5, comment=comment)


def test_normalization_and_server_owned_fields():
    assert ReviewInput(rating=5, comment=" \n ").comment is None
    assert ReviewInput(rating=4, comment=" helpful ").comment == "helpful"
    with pytest.raises(ValidationError):
        ReviewInput(rating=4, reviewed_user_id=uuid4())
    assert "exchange_id" not in PublicReview.model_fields
    assert "email" not in PublicReview.model_fields


@pytest.mark.parametrize("ratings", [[], [Decimal(5)], [Decimal(5), Decimal(5)]])
def test_insufficient_distinct_history(ratings):
    assert trust_score(ratings) is None


def test_trust_examples_and_neutral_prior():
    assert trust_score([Decimal(5)] * 3) == Decimal("68.8")
    assert trust_score([Decimal(1)] * 3) == Decimal("31.3")
    assert trust_score([Decimal(3)] * 3) == Decimal("50.0")
    assert trust_score([Decimal(1), Decimal(3), Decimal(5)]) == Decimal("50.0")


def test_score_bounded_and_monotonic():
    for count in (3, 10, 100, 1000):
        low = trust_score([Decimal(1)] * count)
        high = trust_score([Decimal(5)] * count)
        assert 0 <= low <= high <= 100
    assert trust_score([Decimal(5)] * 10) > trust_score([Decimal(5)] * 3)
    assert trust_score([Decimal(4), Decimal(4), Decimal(5)]) > trust_score([Decimal(4)] * 3)


@pytest.mark.parametrize("invalid", [Decimal(0), Decimal(6), Decimal("NaN")])
def test_invalid_means_rejected(invalid):
    with pytest.raises(ValueError):
        trust_score([invalid] * 3)


@pytest.mark.parametrize(
    "both,days,publish", [(False, 13, False), (False, 14, True), (True, 0, True)]
)
async def test_publication_boundaries_and_notification_idempotency(
    monkeypatch, both, days, publish
):
    from datetime import UTC, datetime, timedelta
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock

    from app.modules.reviews import service

    now = datetime(2026, 10, 29, tzinfo=UTC)
    exchange = SimpleNamespace(
        id=uuid4(), status="COMPLETED", completed_at=now - timedelta(days=days)
    )
    rows = [SimpleNamespace(id=uuid4(), reviewed_user_id=uuid4(), published_at=None)]
    if both:
        rows.append(SimpleNamespace(id=uuid4(), reviewed_user_id=uuid4(), published_at=None))
    session = AsyncMock()
    session.scalars.return_value = Mock(all=Mock(return_value=rows))
    notifier = AsyncMock()
    monkeypatch.setattr(service, "notify", notifier)
    assert await service.publish_locked(session, exchange, now) == (len(rows) if publish else 0)
    assert await service.publish_locked(session, exchange, now) == 0
    assert notifier.await_count == (len(rows) if publish else 0)
    session.commit.assert_not_awaited()  # Outer transaction owns publication and notices together.
    if publish:
        assert all(row.published_at == now for row in rows)


async def test_publication_failure_never_commits(monkeypatch):
    from datetime import UTC, datetime
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock

    from app.modules.reviews import service

    exchange = SimpleNamespace(id=uuid4(), status="COMPLETED", completed_at=datetime.now(UTC))
    actor = SimpleNamespace(id=uuid4())
    existing = SimpleNamespace(rating=5, comment=None)
    session = AsyncMock()
    session.scalar.side_effect = [exchange, existing]
    rows = [
        SimpleNamespace(id=uuid4(), reviewed_user_id=uuid4(), published_at=None) for _ in range(2)
    ]
    session.scalars.return_value = Mock(all=Mock(return_value=rows))
    monkeypatch.setattr(service, "notify", AsyncMock(side_effect=RuntimeError("insert failed")))
    with pytest.raises(RuntimeError, match="insert failed"):
        await service.submit(session, actor, exchange.id, ReviewInput(rating=5))
    session.commit.assert_not_awaited()
