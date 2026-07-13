from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="forbid")
    ai_env: str = Field(alias="AI_ENV")
    ai_host: str = Field(alias="AI_HOST")
    ai_port: int = Field(alias="AI_PORT", ge=1, le=65535)
    ai_log_level: str = Field(alias="AI_LOG_LEVEL")
    ai_trusted_hosts: str = Field(alias="AI_TRUSTED_HOSTS")
    ai_body_limit_bytes: int = Field(alias="AI_BODY_LIMIT_BYTES", ge=1024, le=1048576)
    ai_shutdown_timeout_seconds: int = Field(alias="AI_SHUTDOWN_TIMEOUT_SECONDS", ge=1, le=30)

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

    @field_validator("ai_env")
    @classmethod
    def production_log_level(cls, value: str, info: object) -> str:
        return value


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
    )
    values = {name: os.environ[name] for name in names if name in os.environ}
    return Settings.model_validate(values)
