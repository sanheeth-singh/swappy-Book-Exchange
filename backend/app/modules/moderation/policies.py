from uuid import UUID

from app.core.errors import DomainError


def require_not_self(actor_id: UUID, target_id: UUID) -> None:
    if actor_id == target_id:
        raise DomainError("self_target", "You cannot report or block yourself.", 422)


def require_publication_allowed(restricted: bool) -> None:
    if restricted:
        raise DomainError(
            "participation_restricted",
            "New listings and exchanges are restricted. Contact support.",
        )


def require_review(
    admin_id: UUID,
    reporter_id: UUID,
    target_id: UUID,
    status: str,
    target_type: str,
    action: str,
) -> None:
    if admin_id in (reporter_id, target_id):
        raise DomainError("review_conflict", "Another administrator must review this report.")
    if status != "OPEN":
        raise DomainError("report_closed", "This report has already been reviewed.", 409)
    if action == "HIDE_LISTING" and target_type != "LISTING":
        raise DomainError("invalid_review_action", "This report does not target a listing.", 422)
