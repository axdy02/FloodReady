from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.config import Settings
from app.errors import generic_error_handler, generic_not_found, service_error_handler
from app.middleware.request_id import request_id_middleware
from app.middleware.request_limits import body_limit
from app.routes.analysis import router as analysis_router
from app.routes.health import router as health_router
from app.services.providers import AnalysisProvider, build_provider
from app.errors import ServiceError

async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return await service_error_handler(request, ServiceError(422, "VALIDATION_ERROR"))


async def service_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ServiceError):
        return await generic_error_handler(request, exc)
    return await service_error_handler(request, exc)


async def request_validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        return await generic_error_handler(request, exc)
    return await validation_error_handler(request, exc)


def create_app(settings: Settings | None = None, provider: AnalysisProvider | None = None) -> FastAPI:
    selected = settings

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    hosts = selected.ai_trusted_hosts.split(",") if selected is not None else ["localhost"]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.middleware("http")(request_id_middleware)
    if selected is not None:
        app.state.settings = selected
        app.state.provider = provider if provider is not None else build_provider(selected)
        app.middleware("http")(body_limit(selected.ai_body_limit_bytes))
    app.add_exception_handler(ServiceError, service_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, generic_not_found)
    app.add_exception_handler(Exception, generic_error_handler)
    app.include_router(health_router)
    if selected is not None:
        app.include_router(analysis_router)
    return app


app = create_app()
