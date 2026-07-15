# Architecture evidence ledger

This ledger is intentionally explicit about what is in the diagram and what is not. Paths are relative to the repository root. The current working tree has `wireframe/` as the Next.js source directory; the deleted `frontend/` paths shown by `git status` are not treated as live files.

| Diagram element | Evidence | Verified behavior |
|---|---|---|
| Next.js frontend | `wireframe/package.json`; `wireframe/src/features/reports/report-form.tsx`; `wireframe/src/app/(protected)/map/page.tsx` | Holds form state and the selected browser `File`, calls Backend 1, and renders map/report states. |
| Local image preview | `wireframe/src/features/reports/image-preview.tsx` | Uses `URL.createObjectURL(file)` and revokes the object URL; no permanent browser storage. |
| Browser → Backend 1 upload | `wireframe/src/features/reports/api.ts`; `report-form.tsx` | One `image` part in `FormData`, sent to `POST /api/v1/reports/analyze` with the Bearer access token. |
| Backend 1 upload boundary | `backend/src/modules/reports/reports.routes.ts`; `reports.upload.ts` | Authenticates before the Multer parser, limits to one in-memory file, and applies field/part/file limits. |
| Backend 1 image validation | `backend/src/shared/storage/image-processor.ts` | `file-type` signature check, client-MIME match, Sharp decoding/metadata validation, pixel limit, EXIF rotation, and re-encoding. |
| Private image storage | `backend/src/shared/storage/local-image-storage.ts`; `docker-compose.yml` | Opaque `reports/YYYY/MM/<uuid>.<ext>` key under `UPLOAD_DIRECTORY`; Compose persists bytes in `uploads_data`. |
| Draft/analysis persistence | `backend/src/modules/reports/reports.service.ts`; `backend/prisma/schema.prisma`; AI migration | Creates `report_drafts` and `ai_analyses(PROCESSING)` in one transaction after image save. |
| Backend 1 → Backend 2 | `backend/src/modules/reports/reports.ai-client.ts`; `ai-service/app/routes/analysis.py` | Bearer service token, `X-Request-Id`, multipart image bytes, IDs, report description, severity, coordinates, MIME, and allowed severities. |
| Backend 2 preprocessing | `ai-service/app/services/image_preprocessing.py` | Reads and closes upload, validates claimed/actual MIME, decodes, EXIF-transposes, converts RGB, bounds dimensions, and produces a JPEG buffer. |
| Weather context | `ai-service/app/services/weather.py` | Calls Open-Meteo with coordinates, `past_days=2`, `forecast_days=1`, daily precipitation, and current temperature/precipitation. |
| Configured AI provider | `ai-service/app/services/providers.py`; `.env.example`; `ai-service/app/config.py` | `AI_PROVIDER=gemini`; provider calls `models/{AI_MODEL}:generateContent`; example model is `gemini-3.1-flash-lite`. |
| AI response validation | `ai-service/app/schemas/analysis.py`; `app/services/analysis.py`; `backend/src/modules/reports/reports.ai-client.ts` | Pydantic validates provider data; Backend 2 computes weather/image score; Backend 1 Zod-validates the response and correlates `analysisId`. |
| Human final severity | `wireframe/src/features/reports/report-form.tsx`; `reports.service.ts` | User can accept suggestion, keep original, or choose manual final severity; only `finalSeverity` is submitted. |
| Final report transaction | `backend/src/modules/reports/reports.service.ts` | Reuses draft UUID as `flood_reports.id`, moves `ai_analyses.draft_id` to `report_id`, deletes draft, writes audit row. |
| Map persistence read | `wireframe/src/features/map/queries.ts`; `wireframe/src/app/(protected)/map/page.tsx`; backend reports repository | Bounded `GET /api/v1/reports/map` reads PostGIS-backed `flood_reports` and returns a privacy-safe projection. |
| Marker rendering | `wireframe/src/features/map/map-canvas.tsx` | Converts API `{ latitude, longitude }` to GeoJSON `[longitude, latitude]`; MapLibre renders the points. |
| Private image read | `backend/src/modules/reports/reports.routes.ts`; `reports.service.ts`; `wireframe/src/features/reports/report-evidence-image.tsx` | Owner/moderator-authorized `GET /reports/:id/image`; response is private/no-store bytes, then a browser blob URL. |
| Request correlation | `backend/src/middleware/request-id.ts`; `ai-service/app/middleware/request_id.py` | UUID `X-Request-Id` is accepted/generated, forwarded to Backend 2, and returned in response headers/envelopes. It is not a database column. |

## Deliberately absent diagram elements

| Not shown as implemented | Repository finding |
|---|---|
| `Media` table or `mediaId` | No model, migration, or runtime field exists. `image_path` is the storage reference. |
| Signed URLs or object storage | Storage is local filesystem + Docker named volume; image access is an authenticated Backend 1 route. |
| AI queue/workers/websocket | The call is synchronous HTTP from Backend 1 to Backend 2. |
| Draft cleanup job | `expires_at` exists, but no scheduled cleanup implementation was found. |
| Malware scanning / duplicate hash rejection | SHA-256 is recorded for metadata/integrity; no duplicate or malware decision is implemented. |
| AI retry/backoff/idempotency | Timeouts and failures are recorded; no automatic AI retry or idempotency key is implemented. |
| Backend 2 database | Compose passes no `DATABASE_URL` to the FastAPI service, and its source has no database client. |
| Automatic official verification | `verification_status` starts at `SUBMITTED`; AI output is advisory and does not set official verification. |
