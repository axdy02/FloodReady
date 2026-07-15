# Archived pre-AI audit

> Superseded by [00-repository-audit.md](00-repository-audit.md), [01-architecture.md](01-architecture.md), and [03-ai-workflow.md](03-ai-workflow.md). Do not use this file for the current presentation.

**Audit date:** 14 July 2026  
**Milestone scope:** two core features: an authenticated reporting workflow that creates a geotagged report and shows the owner its persisted evidence history, and a reports map that retrieves and renders the same report.

This audit describes the current repository, including the Milestone 2 changes in the working tree. It does not treat planned features as implemented.

## Executive conclusion

The P0 vertical slice now has one clear owner and one real data path:

`Next.js report form -> Node/Express Report API -> PostgreSQL/PostGIS -> Node/Express map API -> MapLibre marker`

The Node service owns the entire application schema in one PostgreSQL `public` schema. The Python FastAPI service is a separately deployed, health-only scaffold; it owns no tables and is outside the P0 request path. Authentication is real and remains required for report creation, report-map reads, and report details. An evidence image is also still required by the current API and schema.

## Actual stack

| Layer | Implemented technology | Current Milestone 2 responsibility | Evidence |
|---|---|---|---|
| Browser UI | Next.js 16.2, React 19, TypeScript, TanStack Query, Zod | Two-feature wireframe across three routes: Reports Map, My Reports, and Submit Flood Report | `frontend/package.json`; `frontend/src/components/app-shell/protected-shell.tsx` |
| Map rendering | MapLibre GL JS 5.24 | Converts API latitude/longitude into GeoJSON point coordinates and renders report markers | `frontend/package.json`; `frontend/src/features/map/map-canvas.tsx` |
| Base map | Configured OpenFreeMap style with OpenStreetMap attribution | Supplies the external style/tile resources underneath application markers | `.env.example`; `frontend/src/lib/env/client.ts` |
| Primary backend microservice | Node.js 24, Express 5, TypeScript, Zod, Prisma 7 | Authentication, report validation, report writes, map reads, moderation, audits, image processing and authorization | `backend/package.json`; `backend/src/routes/index.ts` |
| Second backend microservice | Python/FastAPI | `/health` and `/health/ready` only | `ai-service/README.md`; `ai-service/app/routes/health.py` |
| Database | PostgreSQL 18 with PostGIS 3.6 | Durable application records and generated spatial points | `docker-compose.yml`; `backend/prisma/migrations/20260711000000_init/migration.sql` |
| ORM / data access | Prisma client with PostgreSQL adapter; parameterized raw SQL for spatial reads | The Node service's internal DAL; it is not shared with FastAPI | `backend/src/database/prisma.ts`; `backend/src/modules/reports/reports.repository.ts` |
| Evidence storage | Local opaque report image keys on the `uploads_data` Docker volume | Durable processed image bytes; only the key is stored in `flood_reports.image_path` | `backend/src/shared/storage/local-image-storage.ts`; `docker-compose.yml` |

The repository directory is named FloodFlow, while package names and the application UI use **FloodReady**. The presentation should use FloodReady unless the project is deliberately renamed later.

## Current service boundaries

### Node/Express service

The Node service is the sole system of record. It owns and accesses `users`, `refresh_sessions`, `flood_reports`, `incidents`, and `audit_logs`, along with report image keys and bytes. All modules use the Prisma client exported by `backend/src/database/prisma.ts`.

### FastAPI service

The FastAPI service has no report, triage, model, provider, or database endpoint. Its Compose environment contains no `DATABASE_URL`, and no Node or frontend source calls it for report handling. It must be described as **health-only and outside P0**, not as an implemented AI pipeline.

### Database arrangement

There is one PostgreSQL/PostGIS instance and one application schema: PostgreSQL's default `public` schema. There are no per-microservice schemas, no duplicate report tables, no read model, and no cross-service foreign keys. Only the Node backend, migration job, and optional demo seed receive `DATABASE_URL` in `docker-compose.yml`.

## P0 feature status

| Requirement | Current state | Evidence |
|---|---|---|
| Select a location | Implemented with map click or device location; form begins with no selected location | `frontend/src/features/reports/report-form.tsx` |
| Correct coordinate order | Implemented: API uses named latitude/longitude; MapLibre and PostGIS use longitude first where required | `frontend/src/features/map/map-canvas.tsx`; initial migration |
| Validate report fields | Implemented in frontend and backend. Description is required and 10-1,000 Unicode code points | `report-form-schema.ts`; `reports.validation.ts` |
| Require evidence image | Implemented; one JPEG, PNG, or WebP is required, decoded and re-encoded | `report-form.tsx`; `reports.upload.ts`; `image-processor.ts` |
| Persist report | Implemented through authenticated `POST /api/v1/reports` | `reports.routes.ts`; `reports.service.ts`; `reports.repository.ts` |
| Review own submitted reports | Implemented through authenticated, owner-scoped `GET /api/v1/users/me/reports` with cursor pagination | `frontend/src/features/reports/submitted-reports.tsx`; `reports.routes.ts`; `reports.repository.ts` |
| View persisted evidence photo | Implemented through authorized `GET /api/v1/reports/:reportId/image`; the gallery retrieves image bytes as protected blobs rather than public URLs | `frontend/src/features/reports/report-evidence-image.tsx`; `reports.routes.ts`; `local-image-storage.ts` |
| Required description in database | Implemented as non-null plus a 10-1,000 character check; an ordered compatibility migration normalizes older short/null/blank values first | `schema.prisma`; `20260713000000_normalize_legacy_report_descriptions/migration.sql`; `20260714000000_milestone2_required_description/migration.sql` |
| Retrieve map reports | Implemented through authenticated `GET /api/v1/reports/map` with a bounded bbox | `reports.routes.ts`; `reports.validation.ts`; `reports.repository.ts` |
| Render real report markers | Implemented; the map page calls the report-map API and passes returned reports to MapLibre | `frontend/src/app/(protected)/map/page.tsx`; `frontend/src/features/map/queries.ts` |
| Show stored marker details | Implemented. Marker projection shows category, claimed severity, status, coordinates and time; an authorized detail read supplies the description | `map/page.tsx`; `useReportDetailQuery` in `map/queries.ts` |
| Survive refresh/restart | Database and uploads use named volumes; refresh performs a new API read | `docker-compose.yml`; `milestone2-report-map.test.ts` |
| AI triage | Not implemented and not shown in the P0 interface | `ai-service/app/routes/health.py`; no triage client or route exists |

## Exact working request flow

1. A signed-in user completes `frontend/src/features/reports/report-form.tsx`.
2. The form sends authenticated multipart data to `POST /api/v1/reports`, including one image, description, category, claimed severity, captured time, and coordinates.
3. The Node backend authenticates before parsing the upload, validates the metadata, re-encodes the image, and stores it under an opaque key.
4. One Prisma transaction inserts the `flood_reports` row and its `REPORT_CREATED` audit record. The initial state is `SUBMITTED`; `incident_id` is null.
5. The API returns `201` with the created report ID and timestamps. The success screen links to `/map?report=<id>&lat=<lat>&lng=<lng>`.
6. The map page builds a bounded bbox around that position and calls authenticated `GET /api/v1/reports/map`.
7. The repository queries the generated PostGIS geography point and returns the persisted report projection. `REJECTED` rows are excluded.
8. MapLibre renders `[longitude, latitude]`. Selecting the marker opens the stored-report panel; because the user owns the new report, `GET /api/v1/reports/:id` returns its description.

## Authentication truth

Authentication is implemented rather than mocked. Registration creates a user but no session. Login returns a short-lived Bearer access token and sets the refresh cookie. Report create, report map, report detail, report image, and own-report reads all require a currently active database user. Ordinary users can read full details only for their own reports; moderators and administrators can read all report details.

Evidence: `backend/src/modules/auth`, `backend/src/middleware/authenticate.ts`, and `backend/src/modules/reports/reports.routes.ts`.

## Hard-coded and legacy data

- The Milestone 2 reports map does **not** use the demo report arrays. It consumes `ReportMapDto[]` from `/reports/map`.
- `MapCanvas` retains legacy incident-oriented prop and layer names and contains dormant shelter/weather overlay fixtures. The Milestone 2 map passes only report data and disables those layers.
- Unclaimed legacy pages remain in the source tree for preservation and redirect to `/map`. The protected Milestone 2 navigation exposes **Reports Map**, **My Reports**, and **Submit Flood Report**; `/reports` is the owner-only evidence-history view within the reporting workflow.
- Demo seed data remains available only through the explicit Compose `demo` profile.

## Known incomplete or presentation-risk areas

| Area | Current limitation | Presentation-safe interpretation | Evidence |
|---|---|---|---|
| Reports map viewport query | The map fetches a bounded box around the configured center or success-link coordinates; it does not yet refetch for every pan and zoom | The create-then-show P0 flow works, but this is not a full exploratory map browser | `frontend/src/app/(protected)/map/page.tsx` |
| Map component naming | `MapCanvas` still uses legacy incident-oriented prop and layer names internally | This is dormant implementation debt, not a second data source | `frontend/src/features/map/map-canvas.tsx` |
| Optional AI | FastAPI exposes health/readiness only; no provider-backed triage route exists | AI must stay disabled and be described as future scope | `ai-service/app/routes/health.py`; `ai-service/README.md` |
| Legacy screens | Dashboard, alerts, route planner, community, profile, settings, and retained detail pages redirect to `/map`; `/reports` no longer redirects | Present `/reports/new` and `/reports` as one reporting workflow, plus `/map` as the second core feature; do not claim the redirected pages | `frontend/src/components/app-shell/protected-shell.tsx`; `frontend/src/app/`; `frontend/src/tests/integration/milestone2-routing.test.ts` |
| Runtime proof | The live Compose write/read preflight passed on 14 July 2026, but it still depends on the presentation machine's Docker and network state | Re-run the documented preflight immediately before presenting | `docs/milestone2/07-test-evidence.md`; `scripts/milestone2-preflight.mjs` |

## Documentation and schema hazards found

- `backend/database.dbml` is stale and contains only the PostGIS system table. It must not be used for the presentation schema.
- Root `database.dbml` is an introspection artifact that includes system/migration tables and is too noisy for the presentation.
- `MASTER_SPEC.md` and `docs/compatibility-report.md` describe Milestone 1 scope and historical constraints. They are useful provenance, but these Milestone 2 documents describe the current two-feature presentation slice.
- The source of truth is `backend/prisma/schema.prisma` plus all four committed migration directories.

## Remaining risks and minimum follow-up

1. The isolated backend integration suite and real-stack `scripts/milestone2-preflight.mjs --write-flow` passed on 14 July 2026. Re-run the preflight before presenting because local Docker and network state can change.
2. The reports map currently queries a fixed bbox around the configured or success-link center rather than recomputing from every pan/zoom. This is sufficient for the create-then-show flow, but not a complete exploratory map.
3. The map projection intentionally omits description and reporter identity. The popup fetches description only when `canViewDetails` is true, so the newly submitted report works without weakening privacy.
4. Image evidence remains mandatory. Do not present it as optional unless the API, database, tests, and form are changed together.
5. Keep AI disabled for the presentation. Adding an AI label without a real provider-backed endpoint would be misleading.

## Presentation-safe summary

> FloodReady uses a Next.js wireframe and MapLibre in the browser. Both report creation and map retrieval go through the Node/Express service. That service alone owns one PostgreSQL/PostGIS public schema and the upload store. The FastAPI service is deployed separately but is currently health-only, so it is shown outside the P0 data flow. A created report is stored once in `flood_reports`, then the map reads that same row through `/reports/map`; there is no duplicated map database and no hard-coded report array.
