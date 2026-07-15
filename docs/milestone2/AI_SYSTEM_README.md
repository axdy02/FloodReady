# FloodReady AI system

This document describes the implemented Milestone 2 AI path. It was derived from the current source, configuration, Prisma schema, migrations, and frontend flow. The AI result is advisory community-report triage; it is not official flood verification.

## 1. Overview

- Backend 1 is the Node/Express service. It owns authentication, upload validation, private image storage, drafts, database writes, and the final report.
- Backend 2 is the FastAPI service. It owns the internal analysis endpoint, image preprocessing, weather lookup, provider call, and output validation. It has no database access.
- The configured provider is Gemini, with AI_MODEL=gemini-3.1-flash-lite and AI_MODEL_VERSION=gemini-3.1-flash-lite in the root example environment.
- The provider receives one prepared image plus text. Backend 2 also uses Open-Meteo weather context to calculate a combined validation score.
- AI is optional at runtime: a blank provider key or unavailable provider records a failed analysis, keeps the draft, and permits manual severity selection.
- The user can accept the suggestion, keep the original severity, or choose a manual final severity.

Sources: wireframe/src/features/reports/report-form.tsx, backend/src/modules/reports/reports.service.ts, backend/src/modules/reports/reports.ai-client.ts, ai-service/app/routes/analysis.py, ai-service/app/services/providers.py.

## 2. Complete image lifecycle

1. The browser owns a File object after selection. ImagePreview creates a temporary object URL and revokes it when replaced/unmounted. It is not permanent storage.
2. The selected File is the only file appended as image to POST /api/v1/reports/analyze.
3. Backend 1 receives the upload in Multer memory storage. It accepts one file, with configured maximum body/field/part/file limits.
4. Backend 1 validates the signature and claimed MIME using file-type, validates/decode-checks metadata with Sharp, rotates using EXIF orientation, and re-encodes the image.
5. Backend 1 saves the processed bytes to local private storage under reports/YYYY/MM/<uuid>.<ext>. The database stores the opaque image_path, MIME, byte size, and SHA-256.
6. Backend 1 creates report_drafts and ai_analyses(PROCESSING) in one transaction.
7. Backend 1 sends the processed bytes in a multipart request to Backend 2. Backend 2 does not persist a permanent copy.
8. Backend 2 closes the upload, Pillow validates it again, applies EXIF orientation, converts RGB, bounds the largest dimension, and creates a temporary JPEG buffer.
9. Backend 2 calls Gemini with the prepared image and minimal report context, then returns structured JSON.
10. Backend 1 validates and persists the AI result. On failure it records FAILED or TIMED_OUT with an error code while retaining the draft/image.
11. The user selects finalSeverity. The submit transaction creates flood_reports, transfers the analysis from draft_id to report_id, deletes the draft, and writes an audit row.
12. Later owner evidence reads use authenticated GET /api/v1/reports/:reportId/image; the path is never exposed to the frontend.

There is no signed URL, object-storage provider, Media table, media ID, or scheduled expired-draft cleanup in the current repository. report_drafts.expires_at is recorded for the 30-minute draft lifetime, but cleanup is PLANNED — NOT CURRENTLY IMPLEMENTED.

## 3. Image validation

| Rule | Current implementation |
|---|---|
| Maximum upload size | Backend 1: MAX_UPLOAD_SIZE_MB=10; Backend 2: AI_MAX_IMAGE_BYTES=10485760. |
| Accepted formats | JPEG, PNG, WebP only. Client MIME and detected signature must agree. |
| Signature validation | file-type in backend/src/shared/storage/image-processor.ts; Pillow format validation in Backend 2. |
| Decode validation | Sharp metadata/decode and Pillow source.load(). |
| Pixel ceiling | Backend 1 MAX_IMAGE_PIXELS=20000000; Backend 2 AI_MAX_IMAGE_PIXELS=20000000. |
| Maximum dimension | Backend 2 AI_MAX_IMAGE_DIMENSION=1024; Pillow thumbnails the prepared image to that bound. |
| Minimum dimensions | No minimum dimension rule is implemented. |
| Corrupt image behavior | Controlled invalid-image error; no AI call. |
| Duplicate detection | SHA-256 is stored, but duplicate rejection is PLANNED — NOT CURRENTLY IMPLEMENTED. |
| Malware scanning | PLANNED — NOT CURRENTLY IMPLEMENTED. |
| Filename | Original filename is not retained as storage identity; storage uses a UUID key. |
| Storage key | reports/<UTC year>/<UTC month>/<UUID v4>.<jpg|png|webp>. |

## 4. Selected-photo isolation and identifiers

The browser sends only the current React evidence File in the current FormData. Backend 1 creates draftId and analysisId only after the image is validated and stored. It sends the same processed byte buffer plus those IDs to Backend 2. No Backend 2 API can list or read the upload volume.

    X-Request-Id
      -> report_drafts.id (sent as Backend 2 reportId during analysis)
      -> ai_analyses.id
      -> report_drafts.image_path
      -> reports/YYYY/MM/<uuid>.<ext>

There is no mediaId. On submit, the draft UUID becomes flood_reports.id and the same image key is retained. Concurrent requests use separate request-scoped buffers, UUIDs, analysis rows, and object keys; no global active-image variable exists.

## 5. Metadata and privacy

| Information | Stored where | Sent to Backend 2 | Sent to Gemini |
|---|---|---:|---:|
| draftId / analysisId | Database and request | Yes | No |
| description | Draft/report row | Yes | Yes |
| severityClaim / userSeverity | Draft/report row | Yes | Yes |
| latitude, longitude | Draft/report row | Yes, for weather lookup | No; weather is summarized first |
| Image bytes + MIME | Private storage/request | Yes | Yes, as inline JPEG data |
| image_path, SHA-256, byte size | Database | No | No |
| reporter_id, name, email, password hash | Database/auth context | No | No |
| Access tokens and service token | Request headers/configuration | Service token only to Backend 2 | No |
| Weather summary | AI response persistence | Produced by Backend 2 | Yes, in prompt |

The user is authenticated. reporter_id comes from request.user, not the multipart body. Ownership is enforced for own reports and image reads; map results use a privacy-safe projection. AI does not verify user identity, officially verify flooding, publish alerts, or access other users' images.

## 6. Backend 1 to Backend 2 contract

POST /internal/v1/flood-analyses is token-protected with Authorization: Bearer <AI_SERVICE_TOKEN>. Backend 1 also sends X-Request-Id and Accept: application/json. The body is multipart/form-data with one image file and these fields:

    analysisId: UUID
    reportId: draft UUID during analysis
    mimeType: image/jpeg | image/png | image/webp
    description: 10-1000 characters
    userSeverity: UNKNOWN | MINOR | MODERATE | SEVERE | IMPASSABLE
    latitude: number
    longitude: number
    allowedSeverityValues: JSON array of allowed severities
    image: one file

Backend 1 timeout is AI_SERVICE_TIMEOUT_MS=8000. Backend 2's provider timeout is AI_PROVIDER_TIMEOUT_SECONDS=8; Open-Meteo has a 5-second client timeout. The request ID is generated or accepted by Backend 1 middleware, forwarded, and returned by Backend 2. It is not stored as a database column.

## 7. Model prompt and processing

There is no separate system prompt. GeminiProvider._payload() sends one user content part containing:

    Assess this user-submitted flood image for triage only. Do not claim official verification or exact water depth.
    Description: <description>
    User severity: <user severity>
    Weather context at the reported coordinates: <weather summary>
    Allowed suggested severities: <allowed severities>
    Use weather only as supporting context; image evidence remains primary.
    Return only the requested structured fields.

The image is attached as Gemini inlineData with the prepared JPEG MIME type. generationConfig.responseMimeType is application/json, and responseJsonSchema is generated from the Pydantic ProviderAnalysis schema.

The prompt explicitly limits overclaiming about official verification and exact depth. The current code does not configure temperature, top-p, or maximum output tokens; those values are NOT CONFIGURED. It does not include hidden chain-of-thought instructions.

Processing stages are: internal-token authorization -> metadata validation -> upload-size/MIME checks -> Pillow decode and EXIF transpose -> RGB conversion and bounded JPEG -> Open-Meteo lookup -> Gemini request -> provider response extraction -> JSON/Pydantic validation -> 70/30 image/weather score -> Backend 2 envelope -> Backend 1/Zod validation -> database update.

## 8. AI output contract

Backend 2 returns a success envelope whose data contains:

| Field | Type / allowed values | Stored in ai_analyses |
|---|---|---|
| analysisId | UUID | id correlation |
| status | SUCCEEDED | status |
| floodDetected | boolean | flood_detected |
| suggestedSeverity | project Severity enum | suggested_severity |
| confidenceScore | number 0..1 | confidence_score |
| waterLevelCategory | NONE, ANKLE_LEVEL, KNEE_LEVEL, WAIST_LEVEL, ABOVE_WAIST, UNKNOWN | matching enum column |
| roadPassability | PASSABLE, CAUTION, UNSAFE, IMPASSABLE, UNKNOWN | matching enum column |
| imageQuality | GOOD, FAIR, POOR, UNUSABLE | matching enum column |
| summary | string, 1..500 chars | summary |
| evidenceFlags | allowlisted unique array | JSONB evidence_flags |
| needsHumanReview | boolean | needs_human_review |
| validationScore | number 0..1 | validation_score |
| validationOutcome | ACCEPTED, NEEDS_REVIEW, REJECTED | validation_outcome |
| weatherSummary | string, 1..500 chars | weather_summary |
| weatherPrecipitationMm, weatherTemperatureC, weatherScore | bounded numeric values | weather columns |
| modelName, modelVersion | non-empty strings | matching columns |
| processingTimeMs | integer 0..120000 | processing_time_ms |

Backend 2 validates provider data with Pydantic and Backend 1 validates the complete response with Zod. Unknown fields, invalid enums, invalid ranges, malformed JSON, mismatched analysisId, and non-JSON responses are rejected. Failed attempts store FAILED or TIMED_OUT plus error_code; failed attempts do not store a partial model result.

## 9. Human review and final persistence

The UI exposes Accept AI suggestion, Keep my severity/Continue without AI, and a manual final-severity select. A review confirmation is required before POST /api/v1/reports/:draftId/submit. The final request contains only { finalSeverity }.

    severityClaim = MODERATE
    suggestedSeverity = SEVERE
    finalSeverity = SEVERE
    aiUsed = true
    verificationStatus = SUBMITTED

The AI result remains attached to the report for display. AI does not set verificationStatus=VERIFIED; the saved report remains unverified citizen evidence.

## 10. Failure, consistency, retries, and limits

| Failure | Current behavior |
|---|---|
| Invalid/unsupported image | Backend rejects before storage/AI with controlled 413/415/422 response. |
| Storage failure | No draft/analysis transaction is committed; saved bytes are deleted when the later DB transaction fails. |
| AI unavailable/timeout/invalid JSON | Draft and image remain; analysis is marked FAILED or TIMED_OUT; manual final severity remains available. |
| Database failure after image save | Service attempts to delete the saved key. Full distributed rollback is not available. |
| User abandons draft | Draft/image remain until cleanup exists or another process removes them; expiry is recorded only. |
| Lost final response | UI tells the user to check the map before retrying, but idempotency is not implemented. |
| Provider rate limit | Provider error becomes a controlled failed analysis; automatic backoff is PLANNED — NOT CURRENTLY IMPLEMENTED. |

Current limits include the report IP limiter and authenticated-user limiter: the root example uses 10 report attempts per hour; map reads use 60 requests per 15 minutes per user. Upload processing uses UPLOAD_PROCESSING_CONCURRENCY=2 with UPLOAD_QUEUE_MAX=8. There is no dedicated AI worker queue or provider concurrency limiter.

Automatic retries are not implemented for image storage, Backend 1 to Backend 2, provider calls, or database writes. The frontend offers user-triggered retry for analysis and image/report reads. Invalid input is not retried.

## 11. Current scale vs future scale

Current behavior supports concurrent HTTP requests through separate request state, UUIDs, database rows, and unique storage keys. Backend 1 has bounded upload processing; the synchronous AI call is bounded by an 8-second timeout. Backend 2 is stateless with respect to application data.

The following is PLANNED — NOT CURRENTLY IMPLEMENTED: a durable job queue, horizontally scaled AI workers, global provider concurrency/backpressure, idempotency keys, per-analysis locks, scheduled draft/image cleanup, and websocket/polling job status.

## 12. Startup and verification

The root README documents Compose startup. The direct AI checks are:

    cd ai-service
    .venv/Scripts/python.exe -m pytest
    .venv/Scripts/python.exe -m ruff check .
    .venv/Scripts/python.exe -m mypy app tests

The service remains usable without AI_PROVIDER_API_KEY because DisabledProvider makes the analysis attempt fail cleanly and the draft remains manually submittable. A live provider result or live provider concurrency claim requires a configured key and a real integration run; unit-test mocks are not proof of live provider behavior.

## 13. Readiness checklist

- [x] Only the selected browser file is appended to the analysis request.
- [x] Image is linked to one draft and one analysis attempt.
- [x] Private local storage and opaque keys are used.
- [x] Backend 2 receives image bytes only for the selected request.
- [x] Backend 1 and Backend 2 validate the image and AI response.
- [x] Final severity is user-controlled and AI remains advisory.
- [x] Concurrent upload processing has a bounded capacity.
- [x] Request IDs are propagated across Backend 1 and Backend 2.
- [x] No user identity or token is sent to Gemini.
- [ ] Media table/media ID, signed URLs, scheduled cleanup, automatic retries, idempotency, and AI queue are implemented — PLANNED — NOT CURRENTLY IMPLEMENTED.
- [ ] Compose/frontend path mismatch is resolved — KNOWN REPOSITORY ISSUE (wireframe/ exists; frontend/ is referenced by Compose).
