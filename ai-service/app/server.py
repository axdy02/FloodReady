import uvicorn
from app.config import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.ai_host,
        port=settings.ai_port,
        log_config=None,
        access_log=False,
        timeout_graceful_shutdown=settings.ai_shutdown_timeout_seconds,
    )


if __name__ == "__main__":
    main()
