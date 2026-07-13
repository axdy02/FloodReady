from fastapi import Request
from fastapi.responses import JSONResponse
from collections.abc import Awaitable, Callable
from starlette.responses import Response


def body_limit(limit: int) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    async def middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None and int(content_length) > limit:
            return JSONResponse(
                status_code=413,
                content={
                    "success": False,
                    "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request failed", "details": []},
                    "requestId": request.state.request_id,
                },
            )
        return await call_next(request)

    return middleware
