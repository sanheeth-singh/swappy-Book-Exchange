from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect

from app.core.errors import DomainError
from app.modules.colleges import admin_service
from app.modules.colleges.admin_schemas import (
    AvailabilityInput,
    CampusCreate,
    CampusEdit,
    CollegeCreate,
)
from app.modules.colleges.directory import directory_lock, require_active_campus
from app.modules.notifications.events import NotificationKind
from app.modules.notifications.service import notify_accounts
from app.modules.users.profiles import verified_membership

REASON = "Adding a verified campus."


@pytest.mark.parametrize(
    "payload",
    [
        dict(name=""),
        dict(name="  "),
        dict(name=None),
        dict(name=7),
        dict(name="Bad\x00Name"),
        dict(name="x" * 201),
    ],
)
def test_college_labels_reject_invalid_data(payload):
    with pytest.raises(ValidationError):
        CollegeCreate(**payload, reason=REASON)


@pytest.mark.parametrize(
    "payload", [{}, {"name": None}, {"college_id": str(uuid4())}, {"is_active": False}]
)
def test_campus_edit_requires_labels_and_cannot_reparent_or_change_status(payload):
    with pytest.raises(ValidationError):
        CampusEdit(**payload, reason=REASON)


def test_label_normalization_and_password_whitespace_preserved():
    assert CollegeCreate(name="  Example   College  ", reason=REASON).name == "Example College"
    campus = CampusCreate(
        college_id=uuid4(), name=" Main   Campus ", city="New   Delhi", reason=REASON
    )
    assert campus.name == "Main Campus" and campus.city == "New Delhi"
    value = AvailabilityInput(
        is_active=False, current_password="  secret password  ", reason=REASON
    )
    assert value.current_password.get_secret_value() == "  secret password  "
    assert "secret password" not in repr(value)
    with pytest.raises(ValidationError):
        AvailabilityInput(is_active="false", current_password="secret", reason=REASON)


async def test_directory_barrier_modes_and_no_implicit_commit():
    session = AsyncMock()
    await directory_lock(session)
    assert "pg_advisory_xact_lock_shared" in str(
        session.execute.await_args.args[0].compile(dialect=dialect())
    )
    await directory_lock(session, exclusive=True)
    assert "pg_advisory_xact_lock(" in str(
        session.execute.await_args.args[0].compile(dialect=dialect())
    )
    session.commit.assert_not_awaited()


async def test_nonadmin_cannot_take_directory_write_lock():
    session = AsyncMock()
    with pytest.raises(DomainError):
        await admin_service.admin_write(session, SimpleNamespace(is_admin=False, is_active=True))
    session.execute.assert_not_awaited()


async def test_recheck_admin_role_after_lock(monkeypatch):
    session = AsyncMock()
    actor = SimpleNamespace(id=uuid4(), is_admin=True, is_active=True)
    fresh = SimpleNamespace(id=actor.id, is_admin=False, is_active=True)
    monkeypatch.setattr(admin_service, "lock_users", AsyncMock(return_value={actor.id: fresh}))
    with pytest.raises(DomainError):
        await admin_service.admin_write(session, actor)
    session.commit.assert_not_awaited()


async def test_wrong_password_never_commits_directory_changes(monkeypatch):
    session = AsyncMock()
    actor = SimpleNamespace(id=uuid4(), is_admin=True, is_active=True, hashed_password="hash")
    monkeypatch.setattr(admin_service, "lock_users", AsyncMock(return_value={actor.id: actor}))
    monkeypatch.setattr(admin_service, "run_in_threadpool", AsyncMock(return_value=False))
    with pytest.raises(DomainError) as exc:
        await admin_service.admin_write(session, actor, "wrong password")
    assert exc.value.code == "password_incorrect"
    session.commit.assert_not_awaited()


async def test_effective_directory_query_checks_both_flags():
    session = AsyncMock()
    session.scalar.return_value = None
    with pytest.raises(DomainError):
        await require_active_campus(session, uuid4())
    sql = str(session.scalar.await_args.args[0].compile(dialect=dialect()))
    assert "colleges.is_active IS true" in sql and "campuses.is_active IS true" in sql


async def test_bulk_directory_notices_are_account_scoped_and_never_commit():
    session = AsyncMock()
    uid = uuid4()
    await notify_accounts(
        session, [uid, uid], NotificationKind.DIRECTORY_AVAILABILITY_CHANGED, "directory:test"
    )
    statement = session.execute.await_args.args[0]
    compiled = statement.compile(dialect=dialect())
    assert "ON CONFLICT (recipient_id, event_key) DO NOTHING" in str(compiled)
    assert compiled.params["resource_id_m0"] == uid
    assert compiled.params["recipient_id_m0"] == uid
    session.commit.assert_not_awaited()


def test_parent_closure_removes_badge_without_rewriting_membership():
    user = SimpleNamespace(is_active=True, campus_id="campus")
    campus = SimpleNamespace(is_active=True)
    membership = SimpleNamespace(
        status="VERIFIED", active=True, campus_id="campus", expires_at=None
    )
    assert not verified_membership(
        user, campus, membership, datetime.now(UTC), college_active=False
    )
