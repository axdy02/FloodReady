import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        AI_ENV="test",
        AI_HOST="127.0.0.1",
        AI_PORT=8000,
        AI_LOG_LEVEL="info",
        AI_TRUSTED_HOSTS="localhost,127.0.0.1",
        AI_BODY_LIMIT_BYTES=65536,
        AI_SHUTDOWN_TIMEOUT_SECONDS=10,
        AI_INTERNAL_TOKEN="a" * 43,
        AI_PROVIDER="gemini",
        AI_PROVIDER_BASE_URL="https://generativelanguage.googleapis.com/v1beta",
        AI_PROVIDER_API_KEY="",
        AI_MODEL="gemini-3.1-flash-lite",
        AI_MODEL_VERSION="gemini-3.1-flash-lite",
        AI_PROVIDER_TIMEOUT_SECONDS=8,
        AI_MAX_IMAGE_BYTES=32768,
        AI_MAX_IMAGE_PIXELS=1000000,
        AI_MAX_IMAGE_DIMENSION=1024,
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings), headers={"host": "localhost"})
