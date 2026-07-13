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
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings), headers={"host": "localhost"})
