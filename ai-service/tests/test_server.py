from app.server import main
from fastapi.testclient import TestClient
from pytest import MonkeyPatch


def test_server_wiring(monkeypatch: MonkeyPatch) -> None:
    values = {
        "AI_ENV": "test",
        "AI_HOST": "127.0.0.1",
        "AI_PORT": "8000",
        "AI_LOG_LEVEL": "info",
        "AI_TRUSTED_HOSTS": "localhost,127.0.0.1",
        "AI_BODY_LIMIT_BYTES": "65536",
        "AI_SHUTDOWN_TIMEOUT_SECONDS": "10",
        "AI_INTERNAL_TOKEN": "a" * 43,
        "AI_PROVIDER": "gemini",
        "AI_PROVIDER_BASE_URL": "https://generativelanguage.googleapis.com/v1beta",
        "AI_PROVIDER_API_KEY": "",
        "AI_MODEL": "gemini-3.1-flash-lite",
        "AI_MODEL_VERSION": "gemini-3.1-flash-lite",
        "AI_PROVIDER_TIMEOUT_SECONDS": "8",
        "AI_MAX_IMAGE_BYTES": "32768",
        "AI_MAX_IMAGE_PIXELS": "1000000",
        "AI_MAX_IMAGE_DIMENSION": "1024",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    observed = {}
    monkeypatch.setattr("uvicorn.run", lambda application, **kwargs: observed.update({"application": application, **kwargs}))
    main()
    assert observed["timeout_graceful_shutdown"] == 10
    with TestClient(observed["application"], headers={"host": "127.0.0.1"}) as client:
        assert client.get("/health/ready").status_code == 200
        assert client.get("/health/ready", headers={"host": "untrusted.example"}).status_code == 400
