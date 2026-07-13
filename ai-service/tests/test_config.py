import pytest
from app.config import Settings


def test_settings_accept_valid_values() -> None:
    settings = Settings(
        AI_ENV="test",
        AI_HOST="127.0.0.1",
        AI_PORT=8000,
        AI_LOG_LEVEL="info",
        AI_TRUSTED_HOSTS="localhost,127.0.0.1",
        AI_BODY_LIMIT_BYTES=65536,
        AI_SHUTDOWN_TIMEOUT_SECONDS=10,
    )
    assert settings.ai_port == 8000


def test_settings_reject_wildcard() -> None:
    with pytest.raises(ValueError):
        Settings(
            AI_ENV="test",
            AI_HOST="127.0.0.1",
            AI_PORT=8000,
            AI_LOG_LEVEL="info",
            AI_TRUSTED_HOSTS="*",
            AI_BODY_LIMIT_BYTES=65536,
            AI_SHUTDOWN_TIMEOUT_SECONDS=10,
        )


def test_settings_reject_invalid_fields() -> None:
    values = {
        "AI_ENV": "test",
        "AI_HOST": "127.0.0.1",
        "AI_PORT": 8000,
        "AI_LOG_LEVEL": "info",
        "AI_TRUSTED_HOSTS": "localhost",
        "AI_BODY_LIMIT_BYTES": 65536,
        "AI_SHUTDOWN_TIMEOUT_SECONDS": 10,
    }
    for key, value in (
        ("AI_ENV", "bad"),
        ("AI_HOST", "https://bad"),
        ("AI_LOG_LEVEL", "trace"),
        ("AI_TRUSTED_HOSTS", "localhost,localhost"),
    ):
        with pytest.raises(ValueError):
            Settings.model_validate({**values, key: value})
