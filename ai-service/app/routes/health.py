from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> JSONResponse:
    return JSONResponse(
        content={"success": True, "data": {"status": "ok"}, "requestId": request.state.request_id},
        headers={"Cache-Control": "no-store"},
    )


@router.get("/health/ready")
async def ready(request: Request) -> JSONResponse:
    return JSONResponse(
        content={
            "success": True,
            "data": {
                "status": "ready",
                "provider": "available" if request.app.state.provider.available else "degraded",
            },
            "requestId": request.state.request_id,
        },
        headers={"Cache-Control": "no-store"},
    )
