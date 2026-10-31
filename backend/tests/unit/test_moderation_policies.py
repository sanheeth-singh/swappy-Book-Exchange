from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.errors import DomainError
from app.modules.moderation.policies import require_not_self, require_review
from app.modules.moderation.schemas import ReportInput


def test_user_cannot_block_or_report_self():
    user = uuid4()
    with pytest.raises(DomainError):
        require_not_self(user, user)
    require_not_self(user, uuid4())


def test_moderators_cannot_review_their_own_reports_or_reports_about_them():
    reporter, target, admin = uuid4(), uuid4(), uuid4()
    require_review(admin, reporter, target, "OPEN", "USER", "RESTRICT_USER")
    for actor in [reporter, target]:
        with pytest.raises(DomainError):
            require_review(actor, reporter, target, "OPEN", "USER", "DISMISS")


def test_resolved_reports_cannot_be_reviewed_twice_and_user_reports_cannot_hide_listings():
    admin, reporter, target = uuid4(), uuid4(), uuid4()
    with pytest.raises(DomainError):
        require_review(admin, reporter, target, "RESOLVED", "LISTING", "HIDE_LISTING")
    with pytest.raises(DomainError):
        require_review(admin, reporter, target, "OPEN", "USER", "HIDE_LISTING")


@pytest.mark.parametrize(
    "payload",
    [
        {"target_type": "USER", "reason": "SPAM"},
        {
            "target_type": "USER",
            "target_user_id": str(uuid4()),
            "listing_id": str(uuid4()),
            "reason": "SPAM",
        },
        {"target_type": "LISTING", "target_user_id": str(uuid4()), "reason": "SPAM"},
        {"target_type": "USER", "target_user_id": str(uuid4()), "reason": "OTHER", "details": " "},
    ],
)
def test_report_targets_are_unambiguous_and_other_requires_an_explanation(payload):
    with pytest.raises(ValidationError):
        ReportInput(**payload)


def test_old_exchange_book_snapshots_remain_valid_without_new_moderation_field():
    from app.modules.books.schemas import BookResponse

    snapshot = {
        "id": str(uuid4()),
        "physical_book_id": str(uuid4()),
        "owner_id": str(uuid4()),
        "campus_id": str(uuid4()),
        "title": "Original book",
        "author": "Author",
        "description": "A previous milestone snapshot",
        "condition": "GOOD",
        "condition_notes": "",
        "is_archived": False,
        "is_reserved": False,
        "photos": [],
    }
    assert BookResponse.model_validate(snapshot).is_hidden is False
