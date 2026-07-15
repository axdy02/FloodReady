# AI workflow

1. `frontend/` sends the report and one evidence image to `POST /api/v1/reports`.
2. Backend 1 validates and re-encodes the image, stores it privately, and transactionally creates the final `flood_reports` row plus `ai_analyses(PROCESSING)`.
3. Backend 1 returns the saved report immediately, then schedules an in-process `queueMicrotask` to call Backend 2.
4. Backend 2 runs a LangGraph state graph: `fetch_weather_evidence` gets Open-Meteo context, `analyze_image_evidence` calls Gemini with the prepared image and report context, `validate_provider_output` validates the model object, and `score_validation` combines image confidence with weather evidence.
5. LangGraph returns structured flood detection, suggested severity, confidence, image findings, evidence flags, weather fields, and validation fields. Backend 1 validates and stores the result.
6. On success, the report becomes AI-enriched (`ai_used=true`, AI suggested `final_severity`, `PROVISIONAL`). On failure, the report remains available and the analysis records `FAILED` or `TIMED_OUT`; the owner can retry.
7. The frontend polls while processing and renders the final report as a MapLibre marker from the persisted map projection.

The older `wireframe/` app still exercises `/reports/analyze` and `/:draftId/submit` with a human review step. That is an alternate path, not the main frontend behavior.

The LangGraph is bounded and stateless: it has no tools, memory, checkpointing, autonomous routing, or database access. Backend 1 still owns persistence and the background job lifecycle.
