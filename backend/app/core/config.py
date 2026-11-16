from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.security import validate_secret_key

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def parse_cors_origins(value: object) -> list[str]:
    if isinstance(value, str):
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    elif isinstance(value, (list, tuple, set)):
        origins = [str(origin).strip() for origin in value if str(origin).strip()]
    else:
        raise ValueError("CORS_ORIGINS must be a comma-separated string or list.")

    for origin in origins:
        parsed = urlsplit(origin)
        if origin == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("CORS_ORIGINS must contain explicit HTTP(S) origins, not wildcards.")
        if parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
            raise ValueError("Each CORS origin must contain only a scheme, host, and optional port.")
    return origins


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "production", "testing"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    secret_key: SecretStr
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: DEFAULT_CORS_ORIGINS.copy())

    adaption_api_key: SecretStr | None = None
    adaption_base_url: str = "https://api.prod.adaptionlabs.ai/api/v1"
    adaption_model: str = "deepseek-v4-flash"

    gemini_api_key: SecretStr | None = None
    gemini_image_model: str = "imagen-3.0-generate-002"

    supabase_enabled: bool = False
    supabase_url: str | None = None
    supabase_publishable_key: SecretStr | None = None
    supabase_secret_key: SecretStr | None = None
    database_url: SecretStr | None = None

    @field_validator("secret_key")
    @classmethod
    def check_secret_key(cls, value: SecretStr) -> SecretStr:
        return validate_secret_key(value)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def check_cors_origins(cls, value: object) -> list[str]:
        return parse_cors_origins(value)

    @field_validator(
        "adaption_api_key",
        "gemini_api_key",
        "supabase_publishable_key",
        "supabase_secret_key",
        "database_url",
        mode="before",
    )
    @classmethod
    def empty_secrets_are_unset(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("adaption_base_url")
    @classmethod
    def check_adaption_base_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("ADAPTION_BASE_URL must be an HTTPS URL without embedded credentials.")
        return value.rstrip("/")

    @model_validator(mode="after")
    def validate_environment_configuration(self) -> Settings:
        if self.environment == "production":
            if "cors_origins" not in self.model_fields_set:
                raise ValueError("Production requires explicitly configured CORS_ORIGINS.")
            if any(not origin.startswith("https://") for origin in self.cors_origins):
                raise ValueError("Production CORS origins must use HTTPS.")

        if self.supabase_enabled and not all((self.supabase_url, self.supabase_secret_key)):
            raise ValueError(
                "SUPABASE_ENABLED requires SUPABASE_URL and SUPABASE_SECRET_KEY."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
