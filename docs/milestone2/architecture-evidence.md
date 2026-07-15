# Architecture evidence ledger

Paths are relative to the repository root. The current architecture uses `frontend/` as the main user-facing application and keeps `wireframe/` as a separate comparison/testing app.

| Diagram element | Evidence | Verified behavior |
|---|---|---|
| Main Next.js frontend | `frontend/package.json`; `frontend/src/features/reports/report-form.tsx`; `frontend/src/app/(protected)/map/page.tsx` | Collects report fields and one browser `File`, calls Backend 1, polls report state, and renders MapLibre markers. |
| Alternate wireframe app | `wireframe/package.json`; `wireframe/src/features/reports/report-form.tsx` | Preserves the older draft/review flow on its separate port; it is not the primary flow. |
| Browser image preview | `frontend/src/features/reports/image-preview.tsx` | Uses a temporary object URL and revokes it; no permanent browser storage. |
| Browser -> Backend 1 upload | `frontend/src/features/reports/api.ts`; `frontend/src/features/reports/report-form.tsx` | Sends one `image` part in `FormData` to `POST /api/v1/reports`. |
| Backend 1 upload boundary | `backend/src/modules/reports/reports.routes.ts`; upload middleware | Authenticates before Multer, limits to one in-memory file, and applies field/part/file limits. |
| Backend 1 image validation | `backend/src/shared/storage/image-processor.ts` | Checks signature/MIME, decodes with Sharp, enforces pixel limits, applies EXIF orientation, and re-encodes. |
| Private image storage | `backend/src/shared/storage/local-image-storage.ts`; `docker-compose.yml` | Stores opaque `reports/YYYY/MM/<uuid>.<ext>` keys in the local upload volume. |
| Immediate report persistence | `backend/src/modules/reports/reports.service.ts` | `create()` saves the image, creates `flood_reports` and `ai_analyses(PROCESSING)` in one transaction, then returns 201. |
| In-process background handoff | `backend/src/modules/reports/reports.service.ts` | `queueMicrotask()` invokes analysis after the response; no durable queue or worker is present. |
| Backend 1 -> Backend 2 | `backend/src/modules/reports/reports.ai-client.ts`; `ai-service/app/routes/analysis.py` | Bearer service token, request ID, report/analysis IDs, text fields, coordinates, MIME, allowed severities, and processed image bytes. |
| Backend 2 preprocessing | `ai-service/app/services/image_preprocessing.py` | Validates the upload with Pillow, applies EXIF orientation, converts RGB, and produces a bounded JPEG buffer. |
| LangGraph orchestration | `ai-service/app/services/analysis.py`; `ai-service/requirements.in` | Runs `fetch_weather_evidence` -> `analyze_image_evidence` -> `validate_provider_output` -> `score_validation` as a bounded, stateless graph. |
| Weather context | `ai-service/app/services/weather.py` | Calls Open-Meteo for recent/current weather at the report coordinates. |
| Configured AI provider | `ai-service/app/services/providers.py`; `.env.example`; `ai-service/app/config.py` | Uses the configured Gemini provider/model and requests structured JSON. |
| AI response validation | `ai-service/app/schemas/analysis.py`; `ai-service/app/services/analysis.py`; Backend 1 AI client | Pydantic validates provider data, Backend 2 computes validation fields, and Backend 1 Zod-validates the response. |
| Background result persistence | `backend/src/modules/reports/reports.service.ts` | Success updates `ai_analyses`, `ai_used`, `final_severity`, and `verification_status` in one transaction; failure records `FAILED`/`TIMED_OUT`. |
| Map persistence read | `frontend/src/features/map/queries.ts`; `frontend/src/app/(protected)/map/page.tsx`; backend reports repository | `GET /api/v1/reports/map` reads PostGIS-backed reports and returns a privacy-safe projection. |
| Marker rendering | `frontend/src/features/map/map-canvas.tsx` | Converts `{ latitude, longitude }` to GeoJSON `[longitude, latitude]`; pending AI uses a neutral marker state. |
| Private image read | Backend report routes/service; `frontend/src/features/reports/report-evidence-image.tsx` | Authorized report access returns private/no-store bytes and the browser uses a blob URL. |
| Request correlation | Backend request-ID middleware; AI-service request-ID middleware | `X-Request-Id` is accepted/generated, forwarded, and returned; it is not a database column. |

## Deliberately absent diagram elements

| Not shown as implemented | Repository finding |
|---|---|
| `Media` table or `mediaId` | No model, migration, or runtime field exists; `image_path` is the storage reference. |
| Signed URLs or object storage | Storage is local filesystem plus a Docker named volume; image access is an authenticated Backend 1 route. |
| Durable AI queue/workers/websocket | The current handoff is an in-process `queueMicrotask` followed by HTTP to Backend 2. |
| Draft cleanup job | `report_drafts.expires_at` exists for the alternate flow, but no scheduled cleanup implementation was found. |
| Malware scanning / duplicate rejection | SHA-256 is recorded; no malware or duplicate decision is implemented. |
| Automatic AI retry/backoff/idempotency | Failures are recorded and the owner can trigger `retry-ai`; automatic retry is absent. |
| Backend 2 database | The FastAPI service has no application database client or schema access. |
| Official verification | AI output is advisory; it does not establish official flood verification. |
