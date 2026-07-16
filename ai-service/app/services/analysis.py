from time import perf_counter
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.schemas.analysis import AnalysisSuccess, ProviderAnalysis
from app.services.providers import AnalysisProvider, ProviderRequest, ProviderResponseError
from app.services.weather import WeatherEvidence, fetch_weather


class AnalysisGraphInput(TypedDict):
    provider: AnalysisProvider
    request: ProviderRequest
    started_at: float


class AnalysisGraphState(AnalysisGraphInput):
    weather: WeatherEvidence
    raw_provider_analysis: object
    provider_analysis: ProviderAnalysis
    result: AnalysisSuccess


async def _fetch_weather_node(state: AnalysisGraphState) -> dict[str, object]:
    metadata = state["request"].metadata
    return {"weather": await fetch_weather(metadata.latitude, metadata.longitude)}


async def _provider_node(state: AnalysisGraphState) -> dict[str, object]:
    request = state["request"]
    raw = await state["provider"].analyze(
        ProviderRequest(metadata=request.metadata, image=request.image, weather=state["weather"])
    )
    return {"raw_provider_analysis": raw}


def _validate_provider_output_node(state: AnalysisGraphState) -> dict[str, object]:
    return {"provider_analysis": ProviderAnalysis.model_validate(state["raw_provider_analysis"])}


def _score_validation_node(state: AnalysisGraphState) -> dict[str, object]:
    analysis = state["provider_analysis"]
    weather = state["weather"]
    image_score = analysis.confidence_score if analysis.flood_detected else 0.0
    validation_score = round((image_score * 0.7) + (weather.score * 0.3), 4)
    validation_outcome: Literal["ACCEPTED", "NEEDS_REVIEW", "REJECTED"] = (
        "ACCEPTED"
        if analysis.flood_detected and validation_score >= 0.55
        else "NEEDS_REVIEW"
        if validation_score >= 0.30
        else "REJECTED"
    )
    elapsed = int((perf_counter() - state["started_at"]) * 1000)
    provider = state["provider"]
    return {
        "result": AnalysisSuccess(
            **analysis.model_dump(by_alias=True),
            analysisId=state["request"].metadata.analysis_id,
            modelName=provider.model_name,
            modelVersion=provider.model_version,
            processingTimeMs=elapsed,
            validationScore=validation_score,
            validationOutcome=validation_outcome,
            weatherSummary=weather.summary,
            weatherPrecipitationMm=weather.precipitation_mm,
            weatherTemperatureC=weather.temperature_c,
            weatherScore=weather.score,
        )
    }


def build_validation_graph() -> CompiledStateGraph[AnalysisGraphState, None, AnalysisGraphInput, AnalysisGraphState]:
    workflow: StateGraph[AnalysisGraphState, None, AnalysisGraphInput, AnalysisGraphState] = StateGraph(
        AnalysisGraphState,
        input_schema=AnalysisGraphInput,
        output_schema=AnalysisGraphState,
    )
    workflow.add_node("fetch_weather_evidence", _fetch_weather_node)
    workflow.add_node("analyze_image_evidence", _provider_node)
    workflow.add_node("validate_provider_output", _validate_provider_output_node)
    workflow.add_node("score_validation", _score_validation_node)
    workflow.add_edge(START, "fetch_weather_evidence")
    workflow.add_edge("fetch_weather_evidence", "analyze_image_evidence")
    workflow.add_edge("analyze_image_evidence", "validate_provider_output")
    workflow.add_edge("validate_provider_output", "score_validation")
    workflow.add_edge("score_validation", END)
    return workflow.compile()


async def analyze(provider: AnalysisProvider, request: ProviderRequest) -> AnalysisSuccess:
    final_state = await build_validation_graph().ainvoke(
        {"provider": provider, "request": request, "started_at": perf_counter()}
    )
    result = final_state.get("result")
    if not isinstance(result, AnalysisSuccess):
        raise ProviderResponseError
    return result
