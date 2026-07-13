from app.server import main
from pytest import MonkeyPatch


def test_server_wiring(monkeypatch: MonkeyPatch) -> None:
    values = {
        "AI_ENV": "test",
        "AI_HOST": "127.0.0.1",
        "AI_PORT": "8000",
        "AI_LOG_LEVEL": "info",
        "AI_TRUSTED_HOSTS": "localhost",
        "AI_BODY_LIMIT_BYTES": "65536",
        "AI_SHUTDOWN_TIMEOUT_SECONDS": "10",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    observed = {}
    monkeypatch.setattr("uvicorn.run", lambda *args, **kwargs: observed.update(kwargs))
    main()
    assert observed["timeout_graceful_shutdown"] == 10
