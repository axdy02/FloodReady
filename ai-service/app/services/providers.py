import base64
import json
from dataclasses import dataclass
from json import JSONDecodeError
from typing import Protocol, cast

import httpx

from app.config import Settings
from app.schemas.analysis import AnalysisMetadata, ProviderAnalysis
from app.services.image_preprocessing import PreparedImage
from app.services.weather import WeatherEvidence


class ProviderError(Exception):
    pass


class ProviderUnavailableError(ProviderError):
    pass


class ProviderTimeoutError(ProviderError):
    pass


class ProviderResponseError(ProviderError):
    pass


@dataclass(frozen=True, slots=True)
class ProviderRequest:
    metadata: AnalysisMetadata
    image: PreparedImage
    weather: WeatherEvidence | None = None


class AnalysisProvider(Protocol):
    @property
    def available(self) -> bool: ...

    @property
    def model_name(self) -> str: ...

    @property
    def model_version(self) -> str: ...

    async def analyze(self, request: ProviderRequest) -> object: ...


class DisabledProvider:
    available = False
    model_name = "disabled"
    model_version = "disabled"

    async def analyze(self, request: ProviderRequest) -> object:
        raise ProviderUnavailableError


class GeminiProvider:
    available = True

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.model_name = settings.ai_provider_model
        self.model_version = settings.ai_provider_model_version
        self._base_url = f"{settings.ai_provider_base_url.rstrip('/')}/"
        self._api_key = settings.ai_provider_api_key
        self._timeout = settings.ai_provider_timeout_seconds
        self._transport = transport

    async def analyze(self, request: ProviderRequest) -> object:
        payload = self._payload(request)
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    f"models/{self.model_name}:generateContent",
                    headers={"x-goog-api-key": self._api_key, "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException as error:
            raise ProviderTimeoutError from error
        except (httpx.HTTPError, ValueError) as error:
            raise ProviderUnavailableError from error
        try:
            output_text = _extract_output_text(cast(object, response.json()))
            return cast(object, json.loads(output_text))
        except (JSONDecodeError, TypeError, ValueError) as error:
            raise ProviderResponseError from error

    def _payload(self, request: ProviderRequest) -> dict[str, object]:
        metadata = request.metadata
        if request.weather is None:
            raise ProviderResponseError
        image_data = base64.b64encode(request.image.content).decode("ascii")
        allowed = ", ".join(value.value for value in metadata.allowed_severity_values)
        prompt = (
            "Assess this user-submitted flood image for triage only. Do not claim official verification or exact water "
            f"depth. Description: {metadata.description}\nUser severity: {metadata.user_severity.value}\n"
            f"Weather context at the reported coordinates: {request.weather.summary}\n"
            f"Allowed suggested severities: {allowed}. Use weather only as supporting context; image evidence remains "
            "primary. Return only the requested structured fields."
        )
        return {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {"mimeType": request.image.mime_type, "data": image_data},
                        },
                    ],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": ProviderAnalysis.model_json_schema(by_alias=True),
            },
        }


def build_provider(settings: Settings) -> AnalysisProvider:
    if settings.ai_provider == "disabled" or settings.ai_provider_api_key == "":
        return DisabledProvider()
    return GeminiProvider(settings)


def _mapping(value: object) -> dict[str, object] | None:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        return None
    return cast(dict[str, object], value)


def _extract_output_text(body: object) -> str:
    root = _mapping(body)
    if root is None:
        raise ProviderResponseError
    candidates = root.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ProviderResponseError
    for item_value in candidates:
        item = _mapping(item_value)
        if item is None:
            continue
        content = _mapping(item.get("content"))
        if content is None:
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        for content_value in parts:
            entry = _mapping(content_value)
            if entry is not None and isinstance(entry.get("text"), str) and entry["text"] != "":
                return cast(str, entry["text"])
    raise ProviderResponseError
