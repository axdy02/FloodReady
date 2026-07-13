import asyncio
from starlette.requests import Request
from app.errors import error_response, generic_not_found


def test_error_response() -> None:
    response = error_response(400, "VALIDATION_ERROR", "00000000-0000-0000-0000-000000000000")
    assert response.status_code == 400


def test_generic_not_found() -> None:
    request = Request({"type": "http", "method": "GET", "path": "/missing", "headers": []})
    response = asyncio.run(generic_not_found(request, Exception("missing")))
    assert response.status_code == 404
