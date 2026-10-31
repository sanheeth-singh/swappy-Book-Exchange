from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.core.errors import DomainError
from app.modules.colleges.policies import require_browsing, require_participation


def test_profile_incomplete_cannot_browse():
    with pytest.raises(DomainError, match="Complete your profile"):
        require_browsing(name=None, campus_id=None)


def test_profile_complete_can_browse_without_proof():
    require_browsing(name="Student", campus_id=uuid4())


@pytest.mark.parametrize("status", ["NOT_SUBMITTED", "PENDING", "REJECTED", "REVOKED"])
def test_only_approved_membership_permits_participation(status):
    campus = uuid4()
    with pytest.raises(DomainError):
        require_participation(
            status=status, active=True, campus_id=campus, selected_campus_id=campus, expires_at=None
        )


def test_verified_same_campus_permits_participation():
    campus = uuid4()
    require_participation(
        status="VERIFIED",
        active=True,
        campus_id=campus,
        selected_campus_id=campus,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )


def test_approval_cannot_be_used_for_another_campus():
    with pytest.raises(DomainError):
        require_participation(
            status="VERIFIED",
            active=True,
            campus_id=uuid4(),
            selected_campus_id=uuid4(),
            expires_at=None,
        )


@pytest.mark.parametrize(
    "active,expires_at", [(False, None), (True, datetime.now(UTC) - timedelta(seconds=1))]
)
def test_inactive_or_expired_membership_is_denied(active, expires_at):
    campus = uuid4()
    with pytest.raises(DomainError):
        require_participation(
            status="VERIFIED",
            active=active,
            campus_id=campus,
            selected_campus_id=campus,
            expires_at=expires_at,
        )
