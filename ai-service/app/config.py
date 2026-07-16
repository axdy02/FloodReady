from typing import Literal, Self
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="forbid")
    ai_env: str = Field(alias="AI_ENV")
    ai_host: str = Field(alias="AI_HOST")
    ai_port: int = Field(alias="AI_PORT", ge=1, le=65535)
    ai_log_level: str = Field(alias="AI_LOG_LEVEL")
    ai_trusted_hosts: str = Field(alias="AI_TRUSTED_HOSTS")
    ai_body_limit_bytes: int = Field(alias="AI_BODY_LIMIT_BYTES", ge=65536, le=26214400)
    ai_shutdown_timeout_seconds: int = Field(alias="AI_SHUTDOWN_TIMEOUT_SECONDS", ge=1, le=30)
    ai_internal_token: str = Field(alias="AI_INTERNAL_TOKEN", min_length=32, max_length=512, repr=False)
    ai_provider: Literal["disabled", "gemini"] = Field(alias="AI_PROVIDER")
    ai_provider_base_url: str = Field(alias="AI_PROVIDER_BASE_URL")
    ai_provider_api_key: str = Field(alias="AI_PROVIDER_API_KEY", repr=False)
    ai_provider_model: str = Field(alias="AI_MODEL")
    ai_provider_model_version: str = Field(alias="AI_MODEL_VERSION")
    ai_provider_timeout_seconds: float = Field(alias="AI_PROVIDER_TIMEOUT_SECONDS", ge=1, le=120)
    ai_max_image_bytes: int = Field(alias="AI_MAX_IMAGE_BYTES", ge=1024, le=20971520)
    ai_max_image_pixels: int = Field(alias="AI_MAX_IMAGE_PIXELS", ge=1, le=50000000)
    ai_max_image_dimension: int = Field(alias="AI_MAX_IMAGE_DIMENSION", ge=256, le=4096)

    @field_validator("ai_env")
    @classmethod
    def validate_env(cls, value: str) -> str:
        if value not in {"development", "test", "production"}:
            raise ValueError("Invalid AI_ENV")
        return value

    @field_validator("ai_host")
    @classmethod
    def validate_host(cls, value: str) -> str:
        if not value or "://" in value or "/" in value:
            raise ValueError("Invalid AI_HOST")
        return value

    @field_validator("ai_log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        if value not in {"debug", "info", "warning", "error", "critical"}:
            raise ValueError("Invalid AI_LOG_LEVEL")
        return value

    @field_validator("ai_trusted_hosts")
    @classmethod
    def validate_trusted_hosts(cls, value: str) -> str:
        hosts = [item.strip() for item in value.split(",")]
        if (
            not hosts
            or any(not item or "*" in item or "://" in item or "/" in item or ":" in item for item in hosts)
            or len(set(hosts)) != len(hosts)
        ):
            raise ValueError("Invalid AI_TRUSTED_HOSTS")
        return ",".join(hosts)

    @field_validator("ai_internal_token")
    @classmethod
    def validate_internal_token(cls, value: str) -> str:
        if not value.isascii() or not value.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Invalid AI_INTERNAL_TOKEN")
        return value

    @model_validator(mode="after")
    def validate_provider(self) -> Self:
        if self.ai_body_limit_bytes <= self.ai_max_image_bytes:
            raise ValueError("AI_BODY_LIMIT_BYTES must exceed AI_MAX_IMAGE_BYTES")
        if self.ai_provider == "disabled":
            return self
        values = (
            self.ai_provider_base_url,
            self.ai_provider_model,
            self.ai_provider_model_version,
        )
        if any(value.strip() != value or value == "" for value in values):
            raise ValueError("Gemini provider configuration is incomplete")
        parsed = urlparse(self.ai_provider_base_url)
        allowed_schemes = {"https"} if self.ai_env == "production" else {"http", "https"}
        if (
            parsed.scheme not in allowed_schemes
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query != ""
            or parsed.fragment != ""
        ):
            raise ValueError("Invalid AI_PROVIDER_BASE_URL")
        return self


def load_settings(source: dict[str, str] | None = None) -> Settings:
    if source is not None:
        return Settings.model_validate(source)
    names = (
        "AI_ENV",
        "AI_HOST",
        "AI_PORT",
        "AI_LOG_LEVEL",
        "AI_TRUSTED_HOSTS",
        "AI_BODY_LIMIT_BYTES",
        "AI_SHUTDOWN_TIMEOUT_SECONDS",
        "AI_INTERNAL_TOKEN",
        "AI_PROVIDER",
        "AI_PROVIDER_BASE_URL",
        "AI_PROVIDER_API_KEY",
        "AI_MODEL",
        "AI_MODEL_VERSION",
        "AI_PROVIDER_TIMEOUT_SECONDS",
        "AI_MAX_IMAGE_BYTES",
        "AI_MAX_IMAGE_PIXELS",
        "AI_MAX_IMAGE_DIMENSION",
    )
    values = {name: os.environ[name] for name in names if name in os.environ}
    return Settings.model_validate(values)
