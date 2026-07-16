import json
import secrets

from fastapi import APIRouter, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.errors import ServiceError, envelope
from app.schemas.analysis import AnalysisMetadata
from app.services.analysis import analyze
from app.services.image_preprocessing import read_and_prepare_upload
from app.services.providers import (
    ProviderRequest,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

router = APIRouter()


def _authorize(request: Request) -> None:
    expected = f"Bearer {request.app.state.settings.ai_internal_token}"
    received = request.headers.get("authorization", "")
    if not secrets.compare_digest(received, expected):
        raise ServiceError(401, "UNAUTHORIZED")


@router.post("/internal/v1/flood-analyses")
async def create_analysis(
    request: Request,
    analysis_id: str = Form(alias="analysisId"),
    report_id: str = Form(alias="reportId"),
    mime_type: str = Form(alias="mimeType"),
    description: str = Form(),
    user_severity: str = Form(alias="userSeverity"),
    latitude: str = Form(),
    longitude: str = Form(),
    allowed_severity_values: str = Form(alias="allowedSeverityValues"),
    image: UploadFile = Form(),
) -> JSONResponse:
    _authorize(request)
    try:
        allowed = json.loads(allowed_severity_values)
    except json.JSONDecodeError as error:
        raise ServiceError(422, "VALIDATION_ERROR") from error
    try:
        metadata = AnalysisMetadata.model_validate(
            {
                "analysisId": analysis_id,
                "reportId": report_id,
                "mimeType": mime_type,
                "description": description,
                "userSeverity": user_severity,
                "latitude": latitude,
                "longitude": longitude,
                "allowedSeverityValues": allowed,
            }
        )
    except ValidationError as error:
        raise ServiceError(422, "VALIDATION_ERROR") from error
    settings = request.app.state.settings
    prepared = await read_and_prepare_upload(
        image,
        mime_type,
        settings.ai_max_image_bytes,
        settings.ai_max_image_pixels,
        settings.ai_max_image_dimension,
    )
    try:
        result = await analyze(request.app.state.provider, ProviderRequest(metadata=metadata, image=prepared))
    except ProviderTimeoutError as error:
        raise ServiceError(504, "AI_TIMEOUT") from error
    except ProviderUnavailableError as error:
        raise ServiceError(503, "AI_UNAVAILABLE") from error
    except ProviderResponseError as error:
        raise ServiceError(502, "AI_INVALID_RESPONSE") from error
    except ValidationError as error:
        raise ServiceError(502, "AI_INVALID_RESPONSE") from error
    return JSONResponse(
        status_code=200,
        content=envelope(True, result.model_dump(mode="json", by_alias=True), request.state.request_id),
        headers={"Cache-Control": "no-store"},
    )
