from urllib.parse import urlsplit

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import DomainError


def require_trusted_origin(request: Request) -> None:
    settings = get_settings()
    trusted = {settings.api_origin, *settings.cors_origins}
    origin = request.headers.get("origin")
    if origin is not None:
        if origin not in trusted:
            raise DomainError("origin_denied", "Request origin is not allowed.")
        return
    referer = request.headers.get("referer")
    if referer:
        try:
            parsed = urlsplit(referer)
        except ValueError as exc:
            raise DomainError("origin_denied", "Request origin is not allowed.") from exc
        if f"{parsed.scheme}://{parsed.netloc}" not in trusted:
            raise DomainError("origin_denied", "Request origin is not allowed.")
        return
    # Browser-controlled fetch metadata covers same-origin requests without Origin.
    # CLI clients must explicitly provide an allowed Origin; absence is rejected.
    if request.headers.get("sec-fetch-site") == "same-origin":
        return
    raise DomainError("origin_denied", "Provide an allowed request origin.")
