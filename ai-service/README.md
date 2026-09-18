# FloodReady AI service

Backend 2 is a FastAPI service that validates submitted flood evidence for triage. It exposes the internal flood-analysis endpoint and health/readiness endpoints on port 8000.

Only Backend 1 may call `POST /internal/v1/flood-analyses`. The request is bearer-token protected and contains one processed image plus `analysisId`, `reportId`, description, claimed severity, coordinates, MIME type, and allowed severity values. Backend 2 has no PostgreSQL connection and does not permanently store image bytes.

The analysis flow is a LangGraph state graph with four steps:

1. Fetch weather evidence from Open-Meteo for the reported location.
2. Send the prepared image, report description, and weather context to Gemini.
3. Validate Gemini's structured response against the service schema.
4. Combine image confidence and weather evidence into the final validation score and outcome.

The graph is bounded and stateless: it has no user-controlled tools, memory, checkpointing, or autonomous routing. Backend 1 remains responsible for persistence and the background job lifecycle.

The endpoint returns a validated JSON envelope with flood detection, suggested severity, confidence, image findings, weather evidence, validation score/outcome, model metadata, and processing time. Backend 1 validates the response again before persistence. See [the repository API reference](../docs/milestone2/05-api-contract.md) for complete fields and controlled error codes.

## Local verification

From `ai-service/`, install the locked development dependencies and run:

```powershell
.\.venv\Scripts\python.exe -m ruff check app tests scripts
.\.venv\Scripts\python.exe -m ruff format --check app tests scripts
.\.venv\Scripts\python.exe -m mypy app tests scripts
.\.venv\Scripts\python.exe scripts/check_source.py
.\.venv\Scripts\python.exe -m pytest
```
