from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.modules.users.schemas import UserResponse


@pytest.mark.parametrize("is_admin", [False, True])
def test_current_user_response_exposes_server_admin_flag(is_admin):
    user = SimpleNamespace(
        id=uuid4(), email="role-fixture@example.com", display_name=None,
        campus_id=None, is_admin=is_admin, is_participation_restricted=False,
        avatar_id="fixture", bio=None, reading_interests=[],
    )
    assert UserResponse.model_validate(user).model_dump()["is_admin"] is is_admin
