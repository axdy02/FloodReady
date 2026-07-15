# API contract

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `POST /api/v1/reports/analyze` | authenticated user | multipart report fields + one image; returns draft and analysis outcome |
| `POST /api/v1/reports/:reportId/submit` | draft owner | JSON `{ "finalSeverity": "..." }`; creates final report |
| `GET /api/v1/users/me/reports` | authenticated user | own persisted reports |
| `GET /api/v1/reports/:reportId/image` | owner/moderator/admin | protected evidence bytes |
| `GET /api/v1/reports/map` | authenticated user | bounded persisted map markers |
| `POST /internal/v1/flood-analyses` | Backend 1 only | token-protected Backend 2 request containing bounded image/fields and validated coordinates; returns image assessment, weather context, validation score, and outcome |

Every response uses `{ success, data|error, requestId }`. IDs are UUIDs; client-controlled severity values are validated against the fixed enum. `GET /reports/map` exposes only the stored `validationScore` and `validationOutcome` required by the marker detail card, not private image content or exact weather-provider payloads.
