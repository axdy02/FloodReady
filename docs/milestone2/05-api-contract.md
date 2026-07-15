# API contract

The main `frontend/` flow uses these endpoints. All responses use the repository's `{ success, data|error, requestId }` envelope and UUID identifiers.

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/v1/reports` | authenticated user | Multipart report fields plus one image; creates the final report and `ai_analyses(PROCESSING)` and returns `201` immediately |
| `GET /api/v1/users/me/reports` | authenticated user | Own persisted reports; frontend polls while AI is processing |
| `POST /api/v1/reports/:reportId/retry-ai` | report owner | Re-runs a failed or timed-out AI analysis from the stored private image |
| `GET /api/v1/reports/:reportId` | owner/moderator/admin | Protected report detail including persisted AI fields |
| `GET /api/v1/reports/:reportId/image` | owner/moderator/admin | Protected evidence bytes; storage key is not exposed |
| `GET /api/v1/reports/map` | authenticated user | Bounded privacy-safe map markers from persisted `flood_reports` |
| `POST /internal/v1/flood-analyses` | Backend 1 only | Bearer-token protected multipart call to Backend 2 with processed image, report context, and coordinates |

The older `POST /api/v1/reports/analyze` plus `POST /api/v1/reports/:draftId/submit` contract remains for the comparison `wireframe/` app. It is not the canonical port-3000 flow.

`GET /reports/map` exposes marker-safe report and AI status/summary fields, not private image content, `image_path`, reporter identity, credentials, or raw weather-provider payloads.
