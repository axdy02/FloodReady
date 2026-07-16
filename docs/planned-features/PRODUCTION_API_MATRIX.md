# Production API matrix

| Feature | Frontend route/component | Request | Successful response used by UI | Auth | Status |
|---|---|---|---|---|---|
| Reports map | `/map`, `MapPage` | `GET /reports/map?west&south&east&north&limit` | Report points with id, category, severity, coordinates, status, and AI fields | Required | CONNECTED |
| Report detail | `/map`, selected-report panel | `GET /reports/:reportId` | Full persisted report and AI analysis | Required | CONNECTED |
| Report image | `/reports`, image query | `GET /reports/:reportId/image` | Private image blob with cache restrictions | Required | CONNECTED |
| Submit report | `/reports/new` | `POST /reports` multipart report fields + one image | Persisted report with `PENDING_REVIEW`/background-AI state | Required | CONNECTED |
| AI validation/retry | `/reports/new`, My Reports | `POST /reports`; `POST /reports/:id/retry-ai` | Immediate persisted report plus advisory severity, score, weather context, and lifecycle state | Required | CONNECTED |
| Incident feed | `/alerts`, `/area-intelligence` | `GET /incidents` | Public incident list/count | No route auth middleware | CONNECTED |
| Map marker details | `/map`, selected-marker panel | Existing `GET /reports/map` plus `GET /reports/:reportId` | Real marker, severity, validation state, timestamp, and protected detail link | Required | CONNECTED; viewport grouping/list overlays removed |
| Backend clusters/affected circle | `/map` | Required: `GET /clusters` | Cluster id, centroid, report count, radius, lifecycle/risk fields | TBD | BACKEND_MISSING |
| Cluster gallery | `/map`, `/area-intelligence` | Required: `GET /clusters/:id/media` | Permission-filtered media references and report count | TBD | BACKEND_MISSING |
| Alert delivery/dismiss | `/alerts` | Required: `GET /alerts`; `POST /alerts/:id/dismiss` | Alert lifecycle, relevance, and dismissal timestamp | Required | BACKEND_MISSING |
| Predictive alert | `/alerts` | Required: risk-backed alerts API | Explicit predictive-risk score, confidence, and explanation | Required | BACKEND_MISSING |
| Area search/summary | `/area-intelligence` | Required: `GET /area-intelligence/search`; `GET /area-intelligence/summary` | Matched areas plus time-windowed report/weather/risk summary | Required | BACKEND_MISSING |
| Area AI summary | `/area-intelligence` | Required: `GET /area-intelligence/:id/summary` | Generated explanation, source timestamp, and unavailable reason if needed | Required | BACKEND_MISSING |
| Saved areas | `/saved-areas` | Required: `GET/POST/PATCH/DELETE /saved-areas` | Account-owned saved-area records and notification preferences | Required | BACKEND_MISSING; current list is session-only and never presented as account data |
| Road-clear confirmation | planned cluster panel | Required: `POST /clusters/:id/confirmations` | Confirmation record plus updated aggregate count/status | Required | BACKEND_MISSING |

No production browser code calls Gemini, Backend 2, a database, or private media storage. Browser report calls use `NEXT_PUBLIC_API_BASE_URL` through `frontend/src/lib/api/request.ts`. The frontend's separate `/api/geocode` and `/api/weather` route handlers call Nominatim/Open-Meteo only for UI search and area-weather display; they are not the report-AI workflow.
