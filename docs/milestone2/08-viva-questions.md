# Archived viva notes

> Superseded by [09-viva-questions.md](09-viva-questions.md). Do not use this file for the current presentation.

These answers describe the current implementation, not the original proposal. Keep each spoken answer to its first two sentences unless the evaluator asks for evidence.

## Scope and architecture

### 1. What exactly is implemented for Milestone 2?

A signed-in user can submit one geotagged flood report, review their own persisted reports with protected evidence photos, and retrieve the same persisted data on the map. These are exactly two core features across three authenticated routes: the reporting workflow uses `/reports/new` (**Submit Flood Report**) and `/reports` (**My Reports**), while the map feature uses `/map` (**Reports Map**) (`frontend/src/components/app-shell/protected-shell.tsx`).

### 2. Is this a complete product frontend?

No. It is a functional low-fidelity wireframe focused on proving two P0 features through three routes. Unclaimed older pages redirect to `/map`, but `/reports` is an implemented owner-only evidence-history view inside the reporting workflow; only `/reports/new`, `/reports`, and `/map` are presented for Milestone 2.

### 3. What is the actual technology stack?

The frontend is Next.js 16, React 19, TypeScript, TanStack Query, Tailwind CSS, and MapLibre GL. The main backend is Node 24, Express 5, Prisma 7, PostgreSQL 18 and PostGIS 3.6; the second service is a health-only FastAPI application (`frontend/package.json`, `backend/package.json`, `ai-service/requirements.in`).

### 4. What are the responsibilities of the two backend services?

Express owns authentication, report validation, report persistence, image processing, and report/map APIs. FastAPI currently owns only `/health` and `/health/ready`; it performs no AI analysis and owns no data (`backend/src/routes/index.ts`, `ai-service/app/routes/health.py`).

### 5. Does the frontend call both services?

No. The reporting flow calls Express directly through `NEXT_PUBLIC_API_BASE_URL`; no frontend or Express code calls FastAPI. FastAPI is deployed and health-checked but is outside the P0 data path.

### 6. Where does MapLibre belong in the architecture?

MapLibre is a browser-side library inside the frontend, not a microservice. It renders the configured base map and the GeoJSON marker collection in `frontend/src/features/map/map-canvas.tsx`.

### 7. Is there an API gateway or frontend server proxy for report data?

No. Browser API requests go directly to the Express origin configured by `NEXT_PUBLIC_API_BASE_URL`. Next.js has a `/api/status` route for readiness display, but it is not the report API gateway (`frontend/src/app/api/status/route.ts`).

### 8. Why did you keep the architecture this simple?

The milestone needs one reliable write path and focused owner-history and map read paths over the same persisted data. One data-owning service avoids duplicate ownership, synchronization, and message-broker failure modes that the current scope does not need.

## Database and schema

### 9. How many databases or service schemas are there?

There is one PostgreSQL/PostGIS database and one application schema, `public`. The Node application boundary is the only database-accessing boundary: long-running Express plus the one-shot migration and optional demo-seed jobs receive `DATABASE_URL`. The frontend and FastAPI have no database access (`docker-compose.yml`, `backend/src/database/prisma.ts`, `ai-service/.env.example`).

### 10. Is there a shared data-access layer between microservices?

No. Prisma is private to the Express service. FastAPI does not import Prisma, connect to PostgreSQL, or share the generated client.

### 11. What is the schema source of truth?

The exact database history is in `backend/prisma/migrations/`, and the application model is `backend/prisma/schema.prisma`. Presentation DBML is explanatory and must agree with those files; the old root and backend DBML dumps are not the authority.

### 12. Which fields are essential on `FloodReport`?

The important fields are ID, reporter ID, category, required description, reported severity, latitude, longitude, GPS accuracy when applicable, location source, captured/submitted times, image path, verification status, optional incident ID, and timestamps. The database also has a generated PostGIS `geography(Point,4326)` value for spatial queries.

### 13. What are the important relationships?

One `User` can create many `FloodReport` records through `reporter_id`. A report may optionally reference one `Incident`, but new reports are created with `incidentId = null`; automatic aggregation is not implemented.

### 14. Why is `description` now required?

The Milestone 2 flow needs useful stored detail for the marker owner. The frontend and backend require 10 to 1,000 trimmed characters. Migration `20260713000000_normalize_legacy_report_descriptions` safely normalizes earlier short/null/blank values before `20260714000000_milestone2_required_description` sets the column `NOT NULL` and adds the database check.

### 15. Why store latitude and longitude as well as a PostGIS point?

The decimal columns make the API contract and presentation easy to understand. PostgreSQL generates the spatial point from those values, and the GiST index supports bounded geographic reads without trusting clients to provide a separate geometry.

### 16. What coordinate order do you use?

The API uses named `latitude` and `longitude` fields. GeoJSON and `ST_MakePoint` use `[longitude, latitude]`; the implementation explicitly creates GeoJSON coordinates in that order and generates the PostGIS point as longitude first (`map-canvas.tsx`, initial migration).

### 17. What database constraints protect location data?

Latitude is restricted to -90 through 90 and longitude to -180 through 180. `DEVICE_GPS` requires positive bounded GPS accuracy, while `MANUAL` requires accuracy to be null; those rules exist in backend validation and the compatibility migration.

## Reporting workflow and map retrieval

### 18. What endpoint creates the report?

`POST /api/v1/reports` accepts authenticated multipart form data and returns `201` with the created `ReportDto`. Its middleware order applies rate limiting, content-type enforcement, authentication, upload-capacity control, multipart parsing, then controller/service validation (`backend/src/modules/reports/reports.routes.ts`).

### 19. What exact data does the form submit?

It submits category, required description, `severityClaim`, latitude, longitude, `locationSource`, optional GPS accuracy, `capturedAt`, and one image. The current backend genuinely requires the image, so the wireframe does not pretend it is optional (`frontend/src/features/reports/report-form.tsx`).

### 20. How do you prevent duplicate submissions?

The button is disabled while saving, and a `pending` ref rejects a second call even before React finishes rerendering. The frontend integration test fires the button twice and asserts one API call (`milestone2-wireframes.test.tsx`).

### 21. What happens inside the backend after submission?

The service validates and re-encodes the image, saves it under an opaque key, then creates the `FloodReport` and `REPORT_CREATED` audit record in a Prisma transaction. If database creation fails, the saved image is cleaned up (`backend/src/modules/reports/reports.service.ts`).

### 21A. How does My Reports stay owner-only?

The page calls authenticated `GET /api/v1/users/me/reports`; the backend derives the reporter from the Bearer-authenticated actor rather than accepting a reporter ID from the browser. It returns a newest-first cursor page, and the frontend can load older pages without discarding records already shown (`submitted-reports.tsx`, `reports.routes.ts`).

### 21B. How are evidence photos protected?

Each card lazily calls authenticated `GET /api/v1/reports/:reportId/image`. The backend permits the report owner or a moderator/administrator, responds with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`, and never sends `image_path`; the frontend displays a temporary blob URL and revokes it after use (`report-evidence-image.tsx`, `reports.controller.ts`).

### 22. What endpoint supplies map markers?

`GET /api/v1/reports/map` supplies the markers. It is authenticated, requires a bounded west/south/east/north box, excludes rejected reports, applies pagination, and returns `ReportMapDto` records.

### 23. Why not use the public incidents endpoint for this milestone?

New reports are not automatically linked to incidents, so an incidents map cannot prove that a submitted report appears. The current map correctly calls `/reports/map` and renders persisted `flood_reports` rows (`frontend/src/app/(protected)/map/page.tsx`).

### 24. How does the map choose its bounding box?

It centers on the requested report coordinates or configured default, then queries approximately 0.45 degrees in each direction. The backend rejects boxes wider than 2 degrees or with area over one square degree to keep reads bounded (`reports.validation.ts`).

### 25. Is the new marker produced from URL parameters?

No. The success URL carries the ID and coordinates only so the map can center and select. The marker collection still comes from a fresh authenticated `/reports/map` request, so a fabricated URL cannot create a marker.

### 26. Why does the map endpoint omit the description?

It is a privacy-safe projection intended for marker rendering. It omits reporter identity, description, image path, and storage key; `canViewDetails` tells the frontend whether it may make a separate protected `GET /reports/:reportId` request.

### 27. Can every signed-in user read every report description?

No. The map can show the safe marker projection, but full detail is restricted to the report owner or privileged roles. The UI requests detail only when `canViewDetails` is true.

### 28. How does refresh prove persistence?

The report is stored in PostgreSQL, not React state. On refresh the auth flow restores the session, the map queries Express again, and Express reads the same row from PostgreSQL; the backend integration test repeats the map read and asserts the ID remains.

### 29. Which reports are visible on the map?

The map query excludes `REJECTED` records. A new report begins as `SUBMITTED`, so it appears with an explicit unverified status and the safety notice warns that community evidence is not official verification.

### 30. How are marker severity and accessibility handled?

Color supports quick scanning, but the marker panel also prints reported severity and status as text. The selected marker receives a visible highlight, and the interface exposes loading, empty, error, retry, and close states.

## Security, images, and failure handling

### 31. Why is authentication required for this demo?

Each report has a non-null reporter foreign key, and both create and map routes use authentication middleware. Anonymous report submission is not implemented and is not claimed.

### 32. How are passwords and sessions handled?

Passwords use Argon2id. Access tokens are HS512 bearer tokens kept in memory, while refresh tokens are hashed in PostgreSQL and delivered through the HttpOnly `floodready_refresh` cookie (`backend/src/shared/security/`).

### 33. How are uploaded images protected?

The backend accepts one bounded JPEG, PNG, or WebP, checks detected bytes against the claimed MIME type, decodes it with Sharp, rotates and re-encodes it, and stores an opaque server-generated key. It never returns the filesystem path in report DTOs.

### 34. What happens if PostgreSQL or storage is unavailable?

Backend readiness returns 503 unless both the database probe and upload-directory access succeed. The form shows a controlled API error and does not claim success; the success screen is rendered only from a real created DTO.

### 35. What happens if the tile provider is unavailable?

The application data remains persisted, but the basemap may be visually degraded and the UI displays a basemap error. The presentation backup is the API/preflight and integration evidence, clearly labeled as such; it is not a fake live map.

## Testing, AI, and limitations

### 36. What proves the end-to-end backend flow?

`backend/tests/integration/milestone2-report-map.test.ts` creates a real report against an isolated migrated PostGIS database, confirms the Prisma row, reads the same ID through map and detail endpoints, and repeats the map read. It also verifies invalid fields do not persist a row.

### 37. What proves the wireframe behavior?

`frontend/src/tests/integration/milestone2-wireframes.test.tsx` verifies map location capture, duplicate-click prevention, real created-response use, success-link targeting, marker selection, stored detail, and the empty state. Other frontend tests cover auth, environment, API envelopes, and source policy.

### 38. What does the Milestone 2 preflight do?

The canonical command is `node --env-file=.env scripts/milestone2-preflight.mjs --write-flow`. It probes frontend, backend, and health-only FastAPI readiness, then logs in, posts a real multipart report, calls `/reports/map`, and fails unless the same ID and exact coordinates return; if both optional demo credentials are absent, it registers an isolated preflight user automatically (`scripts/milestone2-preflight.mjs`). The live preflight passed every health check and the persisted-report-to-map-marker assertion.

### 39. Is AI triage implemented?

No. AI triage is **disabled**. FastAPI has only health routes, `Readiness` is a simple health-only object, and there are no provider credentials, model dependencies, analysis endpoint, persistence fields, or calls from the P0 flow.

### 40. Why show the AI service at all?

Because it is a real deployed repository component and the evaluator asked to see both backend services. The correct diagram shows it honestly as health-only and outside the P0 path rather than inventing an AI arrow.

### 41. What are the main current limitations?

Authentication is required; images use local single-node storage; base-map tiles need network access; reports are not automatically aggregated into incidents; and AI triage is disabled. There is also no claim of official emergency verification, routing, sensors, dashboards, or authority integration.

### 42. What would you implement next?

Only after the P0 flow stays stable, the next bounded enhancement would be an advisory triage endpoint with a configured provider, strict output schema, timeout/failure handling, explicit user acceptance, and persisted provenance. It would remain advisory and would not automatically verify a report or declare an emergency.

### 43. Why are there two microservices?

The repository already separates the Node application boundary from a Python/FastAPI boundary. Node owns the complete P0 report and authentication path. FastAPI is currently a health-only reserved Python boundary, so P0 would still work without it; I show it because it genuinely exists, not because I am claiming an AI feature.

### 44. Which tile provider is used?

The configured presentation basemap uses the OpenFreeMap Liberty style and carries OpenStreetMap contributor attribution. It is an external visual resource requested by MapLibre; it never supplies or stores FloodReady reports.

### 45. How does clicking the map produce geographic coordinates?

MapLibre's click event exposes `event.lngLat`. The form stores its named `lat` and `lng` values as latitude and longitude. For GeoJSON and PostGIS point construction the code deliberately uses longitude first: `[longitude, latitude]` and `ST_MakePoint(longitude, latitude)`.

### 46. Is report data hard-coded?

No. The P0 map calls authenticated `GET /api/v1/reports/map` and renders the persisted DTOs returned by Express/PostgreSQL. Dormant preview fixtures and the optional, explicitly labelled demo seed are not the P0 report source.

### 47. What happens when AI fails?

AI triage is disabled, so the report form shows no fake AI action or output. If the independent health-only FastAPI container is unavailable, manual report creation and map retrieval still work through Node. A future provider-backed triage failure must remain advisory and must never block manual submission.
