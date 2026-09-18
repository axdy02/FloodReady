# Current API reference

This is the current API reference for the live repository. Backend 1 is served at `http://localhost:3001/api/v1`; the browser uses the configured `NEXT_PUBLIC_API_BASE_URL`. Backend 2 is an internal FastAPI service at `http://localhost:8000` and is not called by the browser.

## Common conventions

- Backend 1 and Backend 2 JSON success responses use `{ success: true, data, requestId }`.
- Error responses use `{ success: false, error: { code, message, details }, requestId }`.
- Clients may send `X-Request-Id` as a UUID; otherwise the service generates one.
- Backend 1 protected routes require `Authorization: Bearer <access token>` unless noted otherwise.
- Backend 1 JSON writes require `Content-Type: application/json`; report create/analyze routes require multipart form data.
- Sensitive Backend 1 routes send `Cache-Control: no-store`. The protected image endpoint uses `private, no-store`.

## Backend 1 public and account APIs

| Method and path | Auth | Request | Result |
|---|---|---|---|
| `GET /health` | No | None | Dependency-independent liveness |
| `GET /health/ready` | No | None | Database and upload-storage readiness |
| `GET /health/services` | Bearer | None | Backend 1 service-readiness view |
| `POST /auth/register` | No | JSON: `name`, `email`, `password` | Creates a user; returns `UserDto` |
| `POST /auth/login` | No | JSON: `email`, `password` | Returns `AuthDto` and sets the HttpOnly refresh cookie |
| `POST /auth/refresh` | Refresh cookie + allowed origin | Empty body | Rotates refresh session and returns `AuthDto` |
| `POST /auth/logout` | Allowed origin; refresh cookie optional | Empty body | Revokes an active refresh session when present and clears the cookie |
| `GET /auth/me` | Bearer | None | Current `UserDto` |
| `GET /users/me` | Bearer | None | Current `UserDto` |
| `PATCH /users/me` | Bearer | JSON: `name` | Updated `UserDto` |
| `GET /users` | ADMIN | Query: `role`, `isActive`, `limit`, `sort`, `cursor` | Paginated users |
| `GET /users/:userId` | ADMIN | UUID path parameter | `UserDto` |
| `PATCH /users/:userId` | ADMIN | JSON: optional `role`, `isActive` | Updated `UserDto` |

Passwords are 12-128 Unicode scalar values (maximum 512 UTF-8 bytes). User list limits are 1-100; collection results use `items`, `limit`, `hasMore`, `nextCursor`, and where applicable `totalCount` inside `data`.

## Backend 1 report APIs

The canonical main-frontend flow is `POST /reports`. It creates the durable report immediately, creates an `ai_analyses` row in `PROCESSING`, responds with `201`, and runs the Backend 2 call afterwards.

| Method and path | Auth | Request | Status / result |
|---|---|---|---|
| `POST /reports` | Bearer | Multipart report fields plus one `image` | `201 ReportDto`; direct persisted report with background AI state |
| `POST /reports/analyze` | Bearer | Same multipart fields plus one `image` | `201 ReportDraftDto`; alternate `wireframe/` draft/review path |
| `POST /reports/:reportId/submit` | Bearer draft owner | JSON: `finalSeverity` | `201 ReportDto`; submits the alternate draft path |
| `GET /reports` | MODERATOR or ADMIN | Report list query | Paginated report records |
| `GET /users/me/reports` | Bearer | Report list query | Authenticated owner's paginated report records |
| `GET /reports/map` | Bearer | Required bounded map query | Privacy-safe `ReportMapDto` page |
| `GET /reports/:reportId` | Owner, MODERATOR, or ADMIN | UUID path parameter | `ReportDto` including AI analysis |
| `GET /reports/:reportId/image` | Owner, MODERATOR, or ADMIN | UUID path parameter | Processed JPEG/PNG/WebP bytes; private/no-store |
| `POST /reports/:reportId/retry-ai` | Report owner | UUID path parameter | `202 ReportDto`; restarts a failed/timed-out analysis |
| `PATCH /reports/:reportId` | Report owner when editable | JSON: one or more of `category`, `description`, `severityClaim` | Updated `ReportDto` |
| `PATCH /reports/:reportId/status` | MODERATOR or ADMIN | JSON: `status`, optional `reasonCode` | Moderated `ReportDto` |

### Multipart report request

`POST /reports` and `POST /reports/analyze` accept exactly one `image` file and these fields:

```text
capturedAt        ISO-8601 timestamp, not more than five minutes in the future
category          ROAD_WATERLOGGING | FLOODED_ROAD | CLOGGED_DRAIN |
                  OVERFLOWING_DRAIN | OPEN_MANHOLE | FALLEN_TREE |
                  STRANDED_VEHICLE | UNDERPASS_FLOODING | OTHER
description       Trimmed 10-1000 characters
severityClaim     UNKNOWN | MINOR | MODERATE | SEVERE | IMPASSABLE
latitude          -90..90, maximum six decimal places
longitude         -180..180, maximum six decimal places
locationSource    DEVICE_GPS | MANUAL
gpsAccuracy       Required for DEVICE_GPS; omitted for MANUAL
image             One JPEG, PNG, or WebP image
```

Backend 1 authenticates before multipart parsing, limits upload capacity, checks detected file signature against the supplied MIME type, validates/normalizes pixels with Sharp, removes unsafe metadata by re-encoding, and stores private bytes under an opaque local key. `image_path` is never returned to the client.

### Report list and map query

Report/own-report queries support optional `category`, `severity`, `status`, `from`, `to`, `limit` (1-100), `sort` (`asc` or `desc`), `cursor`, and an all-or-nothing `west`, `south`, `east`, `north` bounding box. Date ranges are at most 366 days.

`GET /reports/map` requires all four bounds. It additionally limits longitude span to 2 degrees, latitude span to 2 degrees, and bounding-box area to 1 square degree. It omits report description, reporter identity, image metadata, and image bytes. It includes report location, claimed/final severity, verification status, and a marker-safe AI summary.

### AI report state

For the primary flow, Backend 1 initially stores:

```text
finalSeverity       = severityClaim
aiUsed              = false
verificationStatus  = PENDING_REVIEW
aiAnalysis.status   = PROCESSING
```

Successful analysis sets `aiUsed=true`, updates `finalSeverity` to `suggestedSeverity`, and sets `verificationStatus=PROVISIONAL`. Failed or timed-out analysis retains the report and sets the analysis state to `FAILED` or `TIMED_OUT`; the owner may call `retry-ai`.

## Backend 1 incident APIs

| Method and path | Auth | Request | Result |
|---|---|---|---|
| `GET /incidents` | No | Optional incident list query: category, severity, status, date range, pagination, optional full bounding box | Paginated public incident records |
| `GET /incidents/:incidentId` | No | UUID path parameter | Public `IncidentDto` |

Incidents are read-only in this repository. The current report submission flow does not create, verify, or link an incident automatically.

## Backend 2 internal analysis API

| Method and path | Caller | Request | Result |
|---|---|---|---|
| `GET /health` | Infrastructure | None | FastAPI liveness |
| `GET /health/ready` | Infrastructure | None | FastAPI readiness |
| `POST /internal/v1/flood-analyses` | Backend 1 only | Bearer-token multipart analysis request | Structured successful AI analysis or controlled error |

`POST /internal/v1/flood-analyses` requires `Authorization: Bearer <AI_SERVICE_TOKEN>` and receives:

```text
analysisId
reportId
mimeType
description
userSeverity
latitude
longitude
allowedSeverityValues  JSON array of severity values
image                  one processed JPEG/PNG/WebP image
```

Backend 2 validates and bounds the image with Pillow, then runs its LangGraph nodes in order:

```text
fetch_weather_evidence
-> analyze_image_evidence
-> validate_provider_output
-> score_validation
```

The success payload includes `analysisId`, `status=SUCCEEDED`, flood detection, suggested severity, confidence, water-level category, road passability, image quality, summary, evidence flags, human-review flag, validation score/outcome, weather summary/values, model name/version, and processing time. Controlled errors include `UNAUTHORIZED` (401), `VALIDATION_ERROR` (422), `AI_TIMEOUT` (504), `AI_UNAVAILABLE` (503), and `AI_INVALID_RESPONSE` (502).

Backend 2 has no PostgreSQL connection and no permanent image storage. It receives image bytes only for the active internal request; Gemini receives the prepared image as inline data plus limited report and weather context.

## Next.js route handlers

These are frontend-server helper endpoints, not Backend 1 routes:

| Method and path | Purpose | Upstream |
|---|---|---|
| `GET /api/health` | Frontend liveness | None |
| `GET /api/status` | Frontend view of Backend 1 readiness | Backend 1 `/health/ready` |
| `GET /api/geocode?q=<text>` | Place lookup, 2-160 characters | Nominatim OpenStreetMap |
| `GET /api/weather?lat=<number>&lng=<number>` | Area Intelligence weather summary | Open-Meteo forecast API |

The browser never calls Gemini, Backend 2, PostgreSQL, the private uploads volume, or the weather provider used by the report AI workflow directly.

## Source of truth

- Backend 1 route mount: `backend/src/routes/index.ts`
- Backend 1 route guards: `backend/src/modules/*/*.routes.ts`
- Backend 1 request validation: `backend/src/modules/*/*.validation.ts`
- Backend 2 route and schemas: `ai-service/app/routes/analysis.py`, `ai-service/app/schemas/analysis.py`
- Frontend API calls: `frontend/src/lib/api/request.ts`, `frontend/src/lib/api/client.ts`, `frontend/src/features/reports/api.ts`
