from uuid import UUID, uuid4
from collections.abc import Awaitable, Callable
from fastapi import Request
from starlette.responses import Response


async def request_id_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    raw = request.headers.get("X-Request-Id")
    try:
        request_id = str(UUID(raw)) if raw is not None else str(uuid4())
    except ValueError:
        request_id = str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response
