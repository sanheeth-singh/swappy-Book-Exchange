from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.errors import DomainError
from app.modules.chat.schemas import MessageInput
from app.modules.chat.service import require_open


@pytest.mark.parametrize("body", ["", "   ", "a" * 2001, "abc\x00"])
def test_invalid_messages(body):
    with pytest.raises(ValidationError):
        MessageInput(body=body, client_message_id=uuid4())


def test_trim_text_and_reject_forged_sender():
    assert MessageInput(body=" hello\n ", client_message_id=uuid4()).body == "hello"
    with pytest.raises(ValidationError):
        MessageInput(body="hello", client_message_id=uuid4(), sender_id=uuid4())


@pytest.mark.parametrize("status", ["PENDING", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"])
def test_closed_states(status):
    with pytest.raises(DomainError, match="read-only"):
        require_open(
            SimpleNamespace(
                status=status, expires_at=None, requester_confirmed=False, owner_confirmed=False
            )
        )


def test_deadline_does_not_close_waiting_confirmation():
    row = SimpleNamespace(
        status="ACCEPTED",
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
        requester_confirmed=False,
        owner_confirmed=False,
    )
    with pytest.raises(DomainError):
        require_open(row)
    row.status = "WAITING_CONFIRMATION"
    row.requester_confirmed = True
    require_open(row)
