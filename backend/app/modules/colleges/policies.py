from datetime import UTC, datetime
from uuid import UUID

from app.core.errors import DomainError


def require_browsing(*, name: str | None, campus_id: UUID | None) -> None:
    if not name or not name.strip() or campus_id is None:
        raise DomainError("profile_incomplete", "Complete your profile to browse campus books.")


def require_participation(
    *,
    status: str,
    active: bool,
    campus_id: UUID,
    selected_campus_id: UUID,
    expires_at: datetime | None,
) -> None:
    if (
        status != "VERIFIED"
        or not active
        or campus_id != selected_campus_id
        or (expires_at is not None and expires_at <= datetime.now(UTC))
    ):
        raise DomainError("membership_not_eligible", "Active campus verification is required.")
