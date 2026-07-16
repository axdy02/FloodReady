import asyncio
from uuid import uuid4

from app.schemas.analysis import AnalysisMetadata, Severity
from app.services.analysis import analyze
from app.services.image_preprocessing import PreparedImage
from app.services.providers import ProviderRequest
from app.services.weather import WeatherEvidence
from pytest import MonkeyPatch


class StubProvider:
    available = True
    model_name = "gemini-3.1-flash-lite"
    model_version = "gemini-3.1-flash-lite"

    async def analyze(self, request: ProviderRequest) -> object:
        assert request.weather is not None
        return {
            "floodDetected": True,
            "suggestedSeverity": "MINOR",
            "confidenceScore": 0.8,
            "waterLevelCategory": "ANKLE_LEVEL",
            "roadPassability": "CAUTION",
            "imageQuality": "GOOD",
            "summary": "Shallow water is visible on the road.",
            "evidenceFlags": ["ROAD_SURFACE_SUBMERGED"],
            "needsHumanReview": True,
        }


def test_langgraph_runs_weather_image_validation_and_scoring(monkeypatch: MonkeyPatch) -> None:
    async def weather(_: float, __: float) -> WeatherEvidence:
        return WeatherEvidence(True, 12.0, 0.0, 27.0, 1.0, "Recent rain supports this report.")

    monkeypatch.setattr("app.services.analysis.fetch_weather", weather)
    request = ProviderRequest(
        metadata=AnalysisMetadata(
            analysisId=uuid4(),
            reportId=uuid4(),
            mimeType="image/jpeg",
            description="Standing water covers the left lane of the road.",
            userSeverity=Severity.MINOR,
            latitude=28.45,
            longitude=77.03,
            allowedSeverityValues=tuple(Severity),
        ),
        image=PreparedImage(b"image", "image/jpeg", 1, 1),
    )

    result = asyncio.run(analyze(StubProvider(), request))

    assert result.status == "SUCCEEDED"
    assert result.suggested_severity == Severity.MINOR
    assert result.weather_score == 1.0
    assert result.validation_score == 0.86
    assert result.validation_outcome == "ACCEPTED"
