from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from jwt import InvalidTokenError

from app.core.config import get_settings
from app.core.security import decode_token, hash_password, issue_token, verify_password


def test_password_storage_and_incorrect_password():
    hashed = hash_password("test-password-123")
    assert hashed != "test-password-123"
    assert verify_password("test-password-123", hashed)
    assert not verify_password("incorrect", hashed)
    assert not verify_password("incorrect", None)


def test_token_round_trip():
    user_id = uuid4()
    session_id = uuid4()
    claims = decode_token(issue_token(user_id, session_id))
    assert claims.user_id == user_id
    assert claims.session_id == session_id


@pytest.mark.parametrize("variant", ["expired", "wrong_audience", "missing_exp"])
def test_invalid_token_claims_rejected(variant):
    now = datetime.now(UTC)
    claims = {
        "sub": str(uuid4()),
        "sid": str(uuid4()),
        "jti": str(uuid4()),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=1),
        "iss": "swappy",
        "aud": "swappy-api",
    }
    if variant == "expired":
        claims["exp"] = now - timedelta(seconds=1)
    if variant == "wrong_audience":
        claims["aud"] = "another-api"
    if variant == "missing_exp":
        del claims["exp"]
    token = jwt.encode(claims, get_settings().jwt_secret.get_secret_value(), algorithm="HS256")
    with pytest.raises(InvalidTokenError):
        decode_token(token)
