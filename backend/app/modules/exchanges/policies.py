from datetime import datetime
from uuid import UUID

from app.core.errors import DomainError

ACTIVE_STATUSES = ("PENDING", "ACCEPTED", "WAITING_CONFIRMATION")
RESERVED_STATUSES = ("ACCEPTED", "WAITING_CONFIRMATION")


def should_expire(
    status: str,
    expires_at: datetime | None,
    requester_confirmed: bool,
    owner_confirmed: bool,
    now: datetime,
) -> bool:
    return (
        status == "ACCEPTED"
        and expires_at is not None
        and expires_at <= now
        and not requester_confirmed
        and not owner_confirmed
    )


def confirmation_state(requester_confirmed: bool, owner_confirmed: bool) -> str:
    return "COMPLETED" if requester_confirmed and owner_confirmed else "WAITING_CONFIRMATION"


def require_transition(
    action: str,
    status: str,
    actor_id: UUID,
    requester_id: UUID,
    owner_id: UUID,
) -> None:
    if actor_id not in (requester_id, owner_id):
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    if action in ("accept", "reject") and actor_id != owner_id:
        raise DomainError("owner_required", "Only the requested-book owner can do this.")
    if action == "cancel" and status == "PENDING" and actor_id != requester_id:
        raise DomainError("requester_required", "Only the requester can withdraw this proposal.")
    allowed = {
        "accept": ("PENDING",),
        "reject": ("PENDING",),
        "cancel": ("PENDING", "ACCEPTED"),
        "confirm": ("ACCEPTED", "WAITING_CONFIRMATION", "COMPLETED"),
    }
    if status not in allowed[action]:
        raise DomainError("invalid_transition", f"Cannot {action} an exchange in {status}.", 409)
