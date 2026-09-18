# FloodReady AI system

This document describes the current Milestone 2 implementation from the repository source. The AI result is advisory community-report triage; it is not official flood verification.

## 1. Services and primary flow

- `frontend/` is the main Next.js application on port 3000. It submits a report immediately and shows the persisted report while AI validation runs.
- Backend 1 is the Node/Express service. It owns authentication, request validation, image processing, private local storage, report persistence, and the map API.
- Backend 2 is the FastAPI service. It owns the internal analysis endpoint and runs a bounded LangGraph state graph for second-stage image preprocessing, Open-Meteo lookup, provider call, response validation, and scoring. It has no database access and no permanent image storage.
- The configured provider is Gemini. The root example environment configures `AI_MODEL=gemini-3.1-flash-lite`.
- The background handoff is an in-process `queueMicrotask`; there is no durable AI queue or worker service.
- LangGraph is orchestration inside Backend 2, not a separate backend or database. Its nodes are `fetch_weather_evidence`, `analyze_image_evidence`, `validate_provider_output`, and `score_validation`.

The main flow is:

```text
frontend POST /api/v1/reports
  -> Backend 1 validates and re-encodes the image
  -> Backend 1 stores private bytes and creates flood_reports + ai_analyses(PROCESSING)
  -> Backend 1 returns 201 immediately
  -> queueMicrotask calls Backend 2
  -> Backend 2 LangGraph preprocesses, loads weather, calls Gemini, validates, and scores
  -> Backend 1 validates and stores the result
  -> frontend polling/map reads expose the updated severity and AI status
```

On AI success, `ai_analyses` becomes `SUCCEEDED`, `flood_reports.ai_used` becomes true, `final_severity` is updated to the AI `suggestedSeverity`, and `verification_status` becomes `PROVISIONAL`. On failure or timeout, the report remains persisted with its claimed severity and the analysis records `FAILED` or `TIMED_OUT`. The owner can call `POST /api/v1/reports/:id/retry-ai`.

The comparison app in `wireframe/` still exercises the older draft/review endpoints (`/reports/analyze` and `/:draftId/submit`). That is a real alternate path, but it is not the primary `frontend/` behavior described above.

## 2. Complete image lifecycle

1. The browser owns a `File` after selection. The preview uses a temporary object URL and revokes it; this is not permanent storage.
2. `frontend/` sends one `image` part in `POST /api/v1/reports`.
3. Backend 1 receives the upload in Multer memory storage, accepts one file, and applies configured upload limits.
4. Backend 1 checks the file signature and claimed MIME with `file-type`, validates/decode-checks it with Sharp, applies EXIF orientation, and re-encodes the image.
5. Backend 1 writes the processed bytes to local private storage under `reports/YYYY/MM/<uuid>.<ext>`. PostgreSQL stores the opaque `image_path`, MIME, byte size, and SHA-256.
6. One database transaction creates the final `flood_reports` row and its `ai_analyses` row with `PROCESSING` status.
7. The background call sends the processed bytes in multipart form to Backend 2. Backend 2 does not persist a permanent copy.
8. Backend 2 closes the upload, validates it with Pillow, applies EXIF orientation, converts to RGB, and creates a bounded JPEG buffer.
9. Backend 2's LangGraph calls Gemini with the prepared image and report context, validates the structured response, and computes the validation score/outcome.
10. Backend 1 validates the response and updates the analysis/report in one transaction. Failed attempts retain an error code and do not write partial model fields.
11. The frontend polls the owner report query while analysis is processing. The map reads the persisted report and displays a pending marker or the returned AI severity.
12. An authorized owner/moderator can later request the image through `GET /api/v1/reports/:reportId/image`; the storage path is never exposed in DTOs.

There is no signed URL, object-storage provider, `Media` table, media ID, or scheduled cleanup job. `report_drafts.expires_at` belongs to the alternate draft path only.

## 3. Image validation

| Rule | Current implementation |
|---|---|
| Maximum upload size | Backend 1 `MAX_UPLOAD_SIZE_MB=10`; Backend 2 `AI_MAX_IMAGE_BYTES=10485760` |
| Accepted formats | JPEG, PNG, WebP; detected signature and claimed MIME must agree |
| Decode validation | Sharp in Backend 1 and Pillow in Backend 2 |
| Pixel ceiling | 20,000,000 pixels in both services |
| AI maximum dimension | Backend 2 bounds the prepared image to `AI_MAX_IMAGE_DIMENSION=1024` |
| Filename/storage key | Original name is not identity; storage uses a UUID key |
| Duplicate detection | SHA-256 is stored; duplicate rejection is not implemented |
| Malware scanning | Not implemented |

## 4. Selected-photo isolation and identifiers

The browser appends only the current evidence `File`. Backend 1 creates the report and analysis identifiers after validation and storage, then sends the same processed bytes plus those identifiers to Backend 2. No Backend 2 API can list or read the upload volume.

```text
X-Request-Id
  -> flood_reports.id
  -> ai_analyses.id / report_id
  -> flood_reports.image_path
  -> reports/YYYY/MM/<uuid>.<ext>
```

There is no `mediaId`. Concurrent requests use separate request-scoped buffers, UUIDs, analysis rows, and storage keys.

## 5. Metadata and privacy

| Information | Backend 1 | Backend 2 | Gemini |
|---|---:|---:|---:|
| Report/analysis IDs | Stored | Correlation fields | No |
| Description and claimed severity | Stored | Multipart fields | Prompt |
| Latitude/longitude | Stored | Weather lookup | No; summarized weather is sent |
| Processed image bytes | Private local storage | Current request only | Inline JPEG data |
| Image path, hash, size | Stored | No | No |
| Reporter identity and credentials | Auth/database | No | No |
| Weather summary and scores | Stored in `ai_analyses` | Produced | Prompt context and response |

Reporter identity comes from the authenticated request, not the multipart body. AI does not verify identity, officially verify flooding, publish alerts, or access another user's images.

## 6. Backend 1 to Backend 2 contract

Backend 1 calls `POST /internal/v1/flood-analyses` with `Authorization: Bearer <AI_SERVICE_TOKEN>`, `X-Request-Id`, and a multipart body:

```text
analysisId: UUID
reportId: final report UUID
mimeType: image/jpeg | image/png | image/webp
description: 10-1000 characters
userSeverity: UNKNOWN | MINOR | MODERATE | SEVERE | IMPASSABLE
latitude: number
longitude: number
allowedSeverityValues: JSON array
image: one file
```

Backend 1's AI timeout is 8 seconds. Backend 2's provider timeout is 8 seconds and Open-Meteo's client timeout is 5 seconds. The request ID is forwarded and returned; it is not a database column.

## 7. Model prompt and processing

The Gemini provider receives one user content part containing the report description, claimed severity, weather context, allowed severities, and the prepared image. The prompt instructs the model to perform triage only, avoid official verification and exact water-depth claims, use weather only as supporting context, and return only the structured fields requested by the schema.

The image is attached as Gemini `inlineData`. The request asks for JSON and supplies the provider response schema. Temperature, top-p, and maximum output tokens are not configured.

Processing stages are: internal-token authorization -> upload metadata checks -> Pillow decode/EXIF/RGB/bounded JPEG -> LangGraph `fetch_weather_evidence` -> LangGraph `analyze_image_evidence` -> LangGraph `validate_provider_output` -> LangGraph `score_validation` -> Backend 2 envelope -> Backend 1/Zod validation -> database update.

## 8. AI output contract

The success response contains the correlated analysis ID, status, flood detection, suggested severity, confidence score, water-level category, road passability, image quality, summary, evidence flags, human-review flag, validation score/outcome, weather summary and values, model name/version, and processing time. Backend 2 validates provider data with Pydantic; Backend 1 validates the complete response with Zod.

The persisted `ai_analyses` row stores the structured result. Invalid IDs, enums, ranges, JSON, or response shape are rejected. Failed attempts store `FAILED` or `TIMED_OUT` and `error_code`; partial model output is not treated as a successful result.

## 9. Report state and map result

The main frontend does not wait for AI or ask the user to accept/override a suggestion before saving. The initial report stores `final_severity = severity_claim`, `ai_used = false`, and `verification_status = PENDING_REVIEW`. A successful background analysis updates `final_severity` to the AI suggestion and marks the report `PROVISIONAL`; the UI can show the original claim and AI assessment separately. A failed analysis leaves the report available and exposes retry to the owner.

`GET /api/v1/reports/map` returns a privacy-safe projection. MapLibre creates a marker from `[longitude, latitude]`; a processing report uses the pending marker state, while a completed analysis uses its suggested/final severity.

## 10. Failure, consistency, retries, and limits

| Failure | Current behavior |
|---|---|
| Invalid/unsupported image | Rejected before the report transaction or AI call |
| Storage failure | Report transaction is not committed; a saved image is deleted when possible |
| AI unavailable/timeout/invalid JSON | Analysis is marked failed/timed out; report remains persisted |
| Database failure after image save | Backend 1 attempts to delete the saved key; no distributed rollback exists |
| User abandons main report | The report already exists; there is no automatic deletion workflow |
| Lost response | Idempotency is not implemented; the user should check existing reports before retrying |
| Provider rate limit | Controlled failed analysis; automatic backoff is not implemented |

The frontend offers user-triggered analysis retry. Automatic retries, a durable queue, provider backpressure, per-analysis locks, idempotency keys, websocket job status, and scheduled cleanup are not implemented.

## 11. Verification boundary

The repository has tests and static checks for the service contracts, but a live provider result requires `AI_PROVIDER_API_KEY` and a real integration run. A disabled or missing provider key fails cleanly; it does not create a fake AI answer. Neither the AI result nor `verification_status=PROVISIONAL` is official agency verification.
