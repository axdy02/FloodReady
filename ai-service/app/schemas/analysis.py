from enum import StrEnum
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Severity(StrEnum):
    UNKNOWN = "UNKNOWN"
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    IMPASSABLE = "IMPASSABLE"


class WaterLevelCategory(StrEnum):
    NONE = "NONE"
    ANKLE_LEVEL = "ANKLE_LEVEL"
    KNEE_LEVEL = "KNEE_LEVEL"
    WAIST_LEVEL = "WAIST_LEVEL"
    ABOVE_WAIST = "ABOVE_WAIST"
    UNKNOWN = "UNKNOWN"


class RoadPassability(StrEnum):
    PASSABLE = "PASSABLE"
    CAUTION = "CAUTION"
    UNSAFE = "UNSAFE"
    IMPASSABLE = "IMPASSABLE"
    UNKNOWN = "UNKNOWN"


class ImageQuality(StrEnum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    UNUSABLE = "UNUSABLE"


class EvidenceFlag(StrEnum):
    ROAD_SURFACE_SUBMERGED = "ROAD_SURFACE_SUBMERGED"
    VEHICLE_WHEEL_PARTIALLY_SUBMERGED = "VEHICLE_WHEEL_PARTIALLY_SUBMERGED"
    WATER_NEAR_BUILDINGS = "WATER_NEAR_BUILDINGS"
    FAST_MOVING_WATER = "FAST_MOVING_WATER"
    PEOPLE_IN_WATER = "PEOPLE_IN_WATER"
    LOW_VISIBILITY = "LOW_VISIBILITY"
    IMAGE_OBSTRUCTED = "IMAGE_OBSTRUCTED"
    NO_FLOOD_VISIBLE = "NO_FLOOD_VISIBLE"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, str_strip_whitespace=True)


class AnalysisMetadata(StrictModel):
    analysis_id: UUID = Field(alias="analysisId")
    report_id: UUID = Field(alias="reportId")
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = Field(alias="mimeType")
    description: str = Field(min_length=10, max_length=1000)
    user_severity: Severity = Field(alias="userSeverity")
    latitude: float = Field(ge=-85.051128, le=85.051128, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    allowed_severity_values: tuple[Severity, ...] = Field(
        alias="allowedSeverityValues", min_length=1, max_length=len(Severity)
    )

    @field_validator("allowed_severity_values")
    @classmethod
    def validate_allowed_severities(cls, value: tuple[Severity, ...]) -> tuple[Severity, ...]:
        if len(set(value)) != len(value):
            raise ValueError("Duplicate allowed severity")
        return value

    @model_validator(mode="after")
    def validate_user_severity(self) -> Self:
        if self.user_severity not in self.allowed_severity_values:
            raise ValueError("User severity is not allowed")
        return self


class ProviderAnalysis(StrictModel):
    flood_detected: bool = Field(alias="floodDetected")
    suggested_severity: Severity = Field(alias="suggestedSeverity")
    confidence_score: float = Field(alias="confidenceScore", ge=0, le=1, allow_inf_nan=False)
    water_level_category: WaterLevelCategory = Field(alias="waterLevelCategory")
    road_passability: RoadPassability = Field(alias="roadPassability")
    image_quality: ImageQuality = Field(alias="imageQuality")
    summary: str = Field(min_length=1, max_length=500)
    evidence_flags: tuple[EvidenceFlag, ...] = Field(alias="evidenceFlags", max_length=len(EvidenceFlag))
    needs_human_review: bool = Field(alias="needsHumanReview")

    @field_validator("evidence_flags")
    @classmethod
    def validate_evidence_flags(cls, value: tuple[EvidenceFlag, ...]) -> tuple[EvidenceFlag, ...]:
        if len(set(value)) != len(value):
            raise ValueError("Duplicate evidence flag")
        return value


class AnalysisSuccess(ProviderAnalysis):
    analysis_id: UUID = Field(alias="analysisId")
    status: Literal["SUCCEEDED"] = "SUCCEEDED"
    model_name: str = Field(alias="modelName", min_length=1, max_length=100)
    model_version: str = Field(alias="modelVersion", min_length=1, max_length=100)
    processing_time_ms: int = Field(alias="processingTimeMs", ge=0, le=120000)
    validation_score: float = Field(alias="validationScore", ge=0, le=1, allow_inf_nan=False)
    validation_outcome: Literal["ACCEPTED", "NEEDS_REVIEW", "REJECTED"] = Field(alias="validationOutcome")
    weather_summary: str = Field(alias="weatherSummary", min_length=1, max_length=500)
    weather_precipitation_mm: float | None = Field(alias="weatherPrecipitationMm", ge=0, le=5000, allow_inf_nan=False)
    weather_temperature_c: float | None = Field(alias="weatherTemperatureC", ge=-100, le=100, allow_inf_nan=False)
    weather_score: float = Field(alias="weatherScore", ge=0, le=1, allow_inf_nan=False)
