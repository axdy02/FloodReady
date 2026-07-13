import asyncio
from fastapi import Request
from starlette.responses import Response
from app.middleware.request_limits import body_limit


def test_body_limit_allows_small_request() -> None:
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [(b"content-length", b"1")]})
    request.state.request_id = "10000000-0000-0000-0000-000000000000"

    async def next_call(_: Request) -> Response:
        return Response(status_code=200)

    async def invoke() -> Response:
        return await body_limit(10)(request, next_call)

    response: Response = asyncio.run(invoke())
    assert response.status_code == 200


def test_body_limit_rejects_large_request() -> None:
    request = Request({"type": "http", "method": "POST", "path": "/", "headers": [(b"content-length", b"11")]})
    request.state.request_id = "10000000-0000-0000-0000-000000000000"

    async def next_call(_: Request) -> Response:
        return Response(status_code=200)

    async def invoke() -> Response:
        return await body_limit(10)(request, next_call)

    assert asyncio.run(invoke()).status_code == 413
