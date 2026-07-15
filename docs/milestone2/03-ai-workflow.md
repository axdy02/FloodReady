# AI workflow

1. `frontend/` sends the report and one evidence image to `POST /api/v1/reports`.
2. Backend 1 validates and re-encodes the image, stores it privately, and transactionally creates the final `flood_reports` row plus `ai_analyses(PROCESSING)`.
3. Backend 1 returns the saved report immediately, then schedules an in-process `queueMicrotask` to call Backend 2.
4. Backend 2 validates and preprocesses the image, loads supporting weather context from Open-Meteo, and calls the configured Gemini provider with the image and report context.
5. Backend 2 validates structured output and returns flood detection, suggested severity, confidence, image findings, evidence flags, weather fields, and validation fields. Backend 1 validates and stores the result.
6. On success, the report becomes AI-enriched (`ai_used=true`, AI suggested `final_severity`, `PROVISIONAL`). On failure, the report remains available and the analysis records `FAILED` or `TIMED_OUT`; the owner can retry.
7. The frontend polls while processing and renders the final report as a MapLibre marker from the persisted map projection.

The older `wireframe/` app still exercises `/reports/analyze` and `/:draftId/submit` with a human review step. That is an alternate path, not the main frontend behavior.
