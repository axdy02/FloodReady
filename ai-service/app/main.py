from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.config import Settings
from app.middleware.request_id import request_id_middleware
from app.routes.health import router


def create_app(settings: Settings | None = None) -> FastAPI:
    selected = settings

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    hosts = selected.ai_trusted_hosts.split(",") if selected is not None else ["localhost"]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.middleware("http")(request_id_middleware)
    app.include_router(router)
    return app


app = create_app()
