from app.core.errors import DomainError


class SessionError(DomainError):
    """A 401 session failure also removes the browser's unusable refresh cookie."""

    def __init__(self, code: str = "invalid_session", message: str = "Sign in again."):
        super().__init__(code, message, 401)
