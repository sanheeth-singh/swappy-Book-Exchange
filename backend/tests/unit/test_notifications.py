from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.notifications.events import (
    NotificationEvent,
    NotificationKind,
    ResourceType,
    template,
)
from app.modules.notifications.schemas import NotificationResponse, ReadAllInput


def test_all_event_kinds_have_bounded_fixed_templates_and_known_resource_types():
    for kind in NotificationKind:
        resource, title, body = template(kind)
        assert resource in ResourceType
        assert 0 < len(title) <= 120
        assert 0 < len(body) <= 500
        assert "{" not in body  # User-supplied text is not interpolated.
        assert "token" not in body.lower()


@pytest.mark.parametrize("key", ["", "x" * 201])
def test_notification_events_need_a_bounded_idempotency_key(key):
    with pytest.raises(ValueError):
        NotificationEvent(uuid4(), NotificationKind.EXCHANGE_PROPOSED, uuid4(), key)


def test_clients_cannot_choose_another_recipient_when_marking_all_read():
    with pytest.raises(ValidationError):
        ReadAllInput(through_id=uuid4(), recipient_id=uuid4())


def test_notification_api_schema_does_not_expose_internal_event_keys_or_recipient():
    fields = NotificationResponse.model_fields
    assert "event_key" not in fields and "recipient_id" not in fields
    assert "resource_id" in fields


async def test_emitter_never_commits_and_uses_duplicate_safe_insert():
    from unittest.mock import AsyncMock

    from sqlalchemy.dialects.postgresql import dialect

    from app.modules.notifications.service import emit

    session = AsyncMock()
    await emit(
        session,
        NotificationEvent(
            uuid4(),
            NotificationKind.EXCHANGE_PROPOSED,
            uuid4(),
            "exchange:test:proposed",
        ),
    )
    session.commit.assert_not_awaited()
    statement = session.execute.await_args.args[0]
    assert "ON CONFLICT (recipient_id, event_key) DO NOTHING" in str(
        statement.compile(dialect=dialect())
    )


async def test_inbox_http_contract_returns_feed_and_badge_count_in_one_response(monkeypatch):
    from unittest.mock import AsyncMock

    from httpx import ASGITransport, AsyncClient

    from app.api.dependencies.authentication import get_current_user
    from app.api.dependencies.database import get_session
    from app.main import create_app
    from app.modules.notifications import service
    from app.modules.users.models import User

    app = create_app()
    user = User(id=uuid4())

    async def actor():
        return user

    async def database():
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = actor
    app.dependency_overrides[get_session] = database
    monkeypatch.setattr(service, "inbox", AsyncMock(return_value=([], None)))
    monkeypatch.setattr(service, "unread_count", AsyncMock(return_value=3))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/notifications")
    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "next_cursor": None, "unread_count": 3}
    assert service.inbox.await_args.args[1] == user.id


async def test_shared_user_lock_compiles_to_no_key_update_for_postgres():
    from unittest.mock import AsyncMock

    from sqlalchemy.dialects.postgresql import dialect

    from app.modules.users.models import User
    from app.modules.users.queries import lock_users

    user = User(id=uuid4())
    session = AsyncMock()
    session.scalar.return_value = user
    await lock_users(session, [user.id])
    statement = session.scalar.await_args.args[0]
    assert "FOR NO KEY UPDATE" in str(statement.compile(dialect=dialect()))
