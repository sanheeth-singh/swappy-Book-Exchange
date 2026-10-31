from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    imagekit_private_key: SecretStr | None = None
    database_url: str
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_minutes: int = Field(default=15, ge=1, le=120)
    refresh_session_days: int = Field(default=14, ge=1, le=90)
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    api_origin: str = "http://127.0.0.1:8000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("api_origin")
    @classmethod
    def valid_api_origin(cls, value: str) -> str:
        return cls.valid_origin(value)

    @field_validator("cors_origins")
    @classmethod
    def valid_cors_origins(cls, values: list[str]) -> list[str]:
        return [cls.valid_origin(value) for value in values]

    @staticmethod
    def valid_origin(value: str) -> str:
        parsed = urlsplit(value)
        if (
            "*" in value
            or parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Use explicit http(s) origins, without paths or wildcards.")
        return value.rstrip("/")

    @model_validator(mode="after")
    def valid_cookie_mode(self):
        if self.refresh_cookie_samesite == "none" and not self.refresh_cookie_secure:
            raise ValueError("SameSite=None requires REFRESH_COOKIE_SECURE=true.")
        if self.api_origin.startswith("https://") and not self.refresh_cookie_secure:
            raise ValueError("HTTPS API origins require REFRESH_COOKIE_SECURE=true.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
