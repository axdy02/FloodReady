# FloodReady Milestone 2 - one-page presenter cheat sheet

## One-sentence result

> A signed-in user submits a geotagged flood report with one private evidence image; Backend 1 persists it immediately, Backend 2 enriches it with advisory AI analysis, and the same persisted row appears as a MapLibre marker.

## Architecture in 20 seconds

```text
frontend/ :3000
  -> POST /api/v1/reports (multipart)
  -> Backend 1: validate, store image, write report + PROCESSING analysis
  -> 201 immediately; queueMicrotask -> Backend 2
  -> Backend 2 LangGraph: weather -> Gemini -> validate -> score
  -> Backend 1: persist result; GET /reports/map -> MapLibre
```

Backend 1 is the sole database owner. Backend 2 has no database access and no permanent image storage. `wireframe/ :3002` is only the alternate draft/review comparison app.

LangGraph nodes: `fetch_weather_evidence` -> `analyze_image_evidence` -> `validate_provider_output` -> `score_validation`.

## Schema in 20 seconds

- `flood_reports` is the primary report row created by `POST /reports`.
- `ai_analyses.report_id` stores the background attempt and result.
- `report_drafts` is retained for the older `/reports/analyze` path used by `wireframe/`.
- The database stores `image_path` and metadata; bytes are in the private `uploads_data` volume.
- PostGIS stores the generated point; map output uses `[longitude, latitude]`.

## Demo clicks

1. Register/sign in at `http://localhost:3000/register`.
2. Submit a category, claimed severity, description, location, and one image.
3. Show the immediate saved confirmation and pending map marker.
4. Open My Reports, wait for polling/background AI completion, and show the stored AI fields.
5. Open the protected evidence image.
6. Reload Reports Map and show the marker still comes from persisted Backend 1 data.

## Endpoint facts

- Create: `POST /api/v1/reports` - authenticated multipart, returns `201`.
- Own reports: `GET /api/v1/users/me/reports` - authenticated and reporter-scoped.
- Retry: `POST /api/v1/reports/:reportId/retry-ai` - owner-triggered after failure.
- Evidence: `GET /api/v1/reports/:reportId/image` - protected private bytes.
- Markers: `GET /api/v1/reports/map` - bounded privacy-safe projection.
- AI: `POST /internal/v1/flood-analyses` - Backend 1 to Backend 2 only.

## If asked about failure or verification

AI failure does not delete the saved report; it records `FAILED`/`TIMED_OUT` and allows retry. AI output is advisory triage, not official verification. There is no durable AI queue, object storage, signed URL, automatic retry/backoff, or scheduled image cleanup in the current implementation.
