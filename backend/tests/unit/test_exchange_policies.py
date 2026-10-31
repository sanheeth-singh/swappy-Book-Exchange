from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.core.errors import DomainError
from app.modules.exchanges.policies import confirmation_state, require_transition, should_expire


def test_only_accepted_without_confirmation_expires():
    now = datetime.now(UTC)
    past = now - timedelta(seconds=1)
    assert should_expire("ACCEPTED", past, False, False, now)
    assert not should_expire("WAITING_CONFIRMATION", past, True, False, now)
    assert not should_expire("ACCEPTED", now + timedelta(seconds=1), False, False, now)


def test_second_confirmation_completes_and_repeat_is_idempotent():
    assert confirmation_state(True, False) == "WAITING_CONFIRMATION"
    assert confirmation_state(True, True) == "COMPLETED"
    assert confirmation_state(True, False) == "WAITING_CONFIRMATION"


def test_role_and_state_guards():
    requester, owner, outsider = uuid4(), uuid4(), uuid4()
    require_transition("accept", "PENDING", owner, requester, owner)
    require_transition("cancel", "ACCEPTED", owner, requester, owner)
    for action, status, actor in [
        ("accept", "PENDING", requester),
        ("reject", "PENDING", outsider),
        ("cancel", "WAITING_CONFIRMATION", requester),
        ("confirm", "PENDING", owner),
    ]:
        with pytest.raises(DomainError):
            require_transition(action, status, actor, requester, owner)
