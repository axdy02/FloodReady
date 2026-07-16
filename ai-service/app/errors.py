from fastapi import Request
from fastapi.responses import JSONResponse


class ServiceError(Exception):
    def __init__(self, status: int, code: str) -> None:
        super().__init__(code)
        self.status = status
        self.code = code


def envelope(success: bool, data: object, request_id: str) -> dict[str, object]:
    return {"success": success, "data": data, "requestId": request_id}


def error_response(status: int, code: str, request_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "success": False,
            "error": {"code": code, "message": "Request failed", "details": []},
            "requestId": request_id,
        },
    )


async def generic_not_found(request: Request, exc: Exception) -> JSONResponse:
    request_id = request.headers.get("X-Request-Id", "00000000-0000-4000-8000-000000000000")
    return error_response(404, "NOT_FOUND", request_id)


async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
    return error_response(exc.status, exc.code, request.state.request_id)


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(500, "INTERNAL_ERROR", request.state.request_id)
