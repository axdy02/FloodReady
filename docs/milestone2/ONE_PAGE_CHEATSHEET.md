# FloodReady Milestone 2 — one-page presenter cheat sheet

## One-sentence result

> A signed-in user submits one real geotagged report, reviews that persisted report with its protected evidence photo, and sees the same row displayed by MapLibre through `GET /api/v1/reports/map`.

## Scope

**Implemented:** exactly two core features: (1) the reporting workflow, with Submit Flood Report and owner-only My Reports evidence history; (2) Reports Map, including marker detail and persistence proof.

**Presented routes:** `/reports/new`, `/reports`, and `/map` only. The first two are views within the reporting workflow, not a third core feature. Authenticate before the audience sees the browser.

**Not claimed:** AI triage, automatic incident creation, route planning, sensors, analytics, authority dashboard, official verification. **FastAPI is health-only; AI triage is DISABLED.**

## Architecture in 20 seconds

```text
Browser
  ├─ Next.js functional wireframe + MapLibre
  │    ├─ HTTPS tile requests → configured map provider
  │    └─ /api/v1 requests → Express API
  └─ no direct database access

Express API (sole data owner)
  ├─ Prisma → one PostgreSQL 18/PostGIS 3.6 database
  └─ processed image → persistent uploads volume

FastAPI
  └─ /health and /health/ready only; no P0 call, model, provider, or DB
```

No gateway, broker, shared DAL, duplicate report database, or frontend-to-DB access.

## Schema in 20 seconds

- `User 1 → many FloodReport`; Express owns both.
- Core report: `id`, `reporter_id`, `category`, required `description`, `severity_claim`, `latitude`, `longitude`, `location_source`, timestamps, `verification_status`, evidence key, generated PostGIS point.
- Optional `incident_id` exists, but new reports are not automatically aggregated.
- GeoJSON/PostGIS order is **longitude, latitude**. API fields are named separately.
- New status is `SUBMITTED` = community evidence, **unverified**.
- Source of truth: `backend/prisma/schema.prisma` plus `backend/prisma/migrations/`.

## Live-demo clicks

1. Start on `/map`; state that data comes from the Report API.
2. Click **Submit Flood Report**.
3. Choose category + **reported** severity.
4. Enter a unique 10–1,000-character description.
5. Choose one valid non-sensitive image.
6. Click map; point to temporary pin and coordinates.
7. Click **Submit Flood Report** once.
8. Point to returned UUID, `SUBMITTED`, latitude and longitude.
9. Click **View submitted reports**; point to the new record and protected photo.
10. Click that card's **Show on map** link.
11. Point to persisted count and selected marker.
12. Open marker detail: severity, status, coordinates, time, stored description.
13. Refresh and say: “This is a new backend read of the same database row.”

## Endpoint facts

- Create: `POST /api/v1/reports` — authenticated multipart, returns `201 ReportDto`.
- Owner history: `GET /api/v1/users/me/reports` — authenticated and scoped to the signed-in reporter.
- Evidence photo: `GET /api/v1/reports/:reportId/image` — owner/moderator authorized, `private, no-store`, no storage key exposed.
- Markers: `GET /api/v1/reports/map?west&south&east&north` — authenticated, bounded, excludes rejected.
- Detail: `GET /api/v1/reports/:reportId` — owner/moderator protected detail.
- Backend ready: `GET http://127.0.0.1:3001/api/v1/health/ready` checks DB + uploads.
- AI ready: `GET http://127.0.0.1:8000/health/ready` checks only the health-only service.

## Exact transition lines

1. “I will begin with the corrected architecture, because every later screen follows this same request path.”
2. “Now that component ownership is clear, I will show the small schema that supports this flow.”
3. “The schema is deliberately narrow; next I will create one real row through the wireframe.”
4. “The API has returned the stored record; I will verify it in the owner's evidence history, then follow that exact ID and location to the map.”
5. “The live UI proves the behavior; now I will show the automated evidence behind the same path.”
6. “I will close with the exact project boundary and the work I am deliberately not claiming.”

## Start and prove

```powershell
docker compose --env-file .env up --detach --wait --wait-timeout 180 db
docker compose --env-file .env run --rm --no-deps migrate
docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend ai-service frontend
docker compose --env-file .env ps
```

Canonical tested preflight:

```powershell
node --env-file=.env scripts/milestone2-preflight.mjs --write-flow
```

No manual environment or credential loading is required. If both optional demo credentials are absent, the script registers an isolated preflight user. The live run passed all health checks and the required line: `PASS persisted report -> map marker: <uuid>`.

## If something fails

- Inspect: `docker compose --env-file .env logs --tail 100 db backend frontend ai-service`
- DB/API: rerun migration, then restart backend.
- Marker: use success link, wait, click Refresh, confirm correct area.
- Session: sign in again; never present anonymous state as working auth.
- Tiles: state external provider failure and show preflight/test evidence, clearly labeled.
- AI: continue P0 without it and say, “FastAPI is health-only; AI triage is disabled and the report flow does not call it.”
- Preserve data: `docker compose --env-file .env down --remove-orphans` is safe.
- **Never run `down --volumes` during rehearsal or presentation.** It destroys users, reports, audits and uploads.

## Fast answers

- **Who owns tables?** Express only; AI owns none.
- **Why one DB?** One clear owner and no synchronization problem for this scope.
- **Why image required?** Current backend schema and upload pipeline genuinely require one; the UI matches it.
- **How is the photo protected?** The gallery uses a Bearer-authenticated image endpoint; it never receives a public path or storage key.
- **Hard-coded reports?** No. `/reports/map` supplies markers; URL params only center/select.
- **Why description separate?** Map DTO is privacy-limited; owner detail is a second protected request.
- **What proves persistence?** Prisma row + repeated map read in `milestone2-report-map.test.ts`, plus write-flow preflight.
- **Is severity verified?** No; it is the reporter’s claim.
- **Is AI working?** No triage. Health service only, explicitly disabled.

## Final close

> The demonstrated result is deliberately small: exactly two core features, one clear data owner, one persisted report with protected owner evidence history, and one map read of the same row.
