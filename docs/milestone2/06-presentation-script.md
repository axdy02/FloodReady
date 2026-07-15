# Archived presentation script

> Superseded by [08-presentation-script.md](08-presentation-script.md). Do not use this file for the current presentation.

Verified against the working tree on 14 July 2026. Target duration: 6 to 8 minutes. The presentation claim is deliberately narrow: a signed-in user creates a geotagged flood report, the Express service persists it, and the same report appears on the map after a fresh read.

## Non-negotiable speaking rules

- Call the product **FloodReady**; FloodFlow is the repository name.
- Call the interface a **functional low-fidelity wireframe**, not a finished production UI.
- Say **reported severity** or **user-claimed severity**, never verified severity.
- Say **submitted evidence is unverified** until a moderator changes its status.
- Say **AI triage is disabled**. The FastAPI service is health-only and has no analysis endpoint, provider, model, or database.
- Present exactly two core features across three authenticated routes: the reporting workflow uses `/reports/new` and `/reports`, while the reports-map feature uses `/map`. Complete authentication before the audience sees the browser.
- Do not describe old dashboard, route-planning, alert, profile, or demo-mode source files as Milestone 2 features. They are not in the visible Milestone 2 navigation.
- Do not say that a new report creates an incident. New reports currently have `incidentId = null`; incident aggregation is outside this milestone.

## Prepared screen order

1. `docs/milestone2/01-architecture.md` or its rendered architecture diagram.
2. `docs/milestone2/03-schema-presentation.md` or its rendered ER diagram.
3. Browser already signed in at `http://localhost:3000/map`.
4. A small, non-sensitive JPEG, PNG, or WebP image ready in the file picker.
5. Terminal showing the last successful `node --env-file=.env scripts/milestone2-preflight.mjs --write-flow` output.

Do not type credentials or open `.env` during the presentation.

## 6-to-8-minute primary script

### 0:00-0:35 — Opening and corrected scope

**Show:** Title or architecture slide.

**Say:**

> FloodReady is a community flood-reporting prototype. For Milestone 2 I deliberately reduced the visible scope to two features that I can prove end to end: first, a signed-in user submits a geotagged report and reviews that persisted report with its protected evidence photo; second, that same report is retrieved and shown at the correct location on the map. This is a functional wireframe, so the emphasis is correct data flow and schema rather than a large polished frontend.

**Exact transition:**

> I will begin with the corrected architecture, because every later screen follows this same request path.

### 0:35-1:35 — Correct architecture

**Show:** Presentation architecture diagram.

**Say:**

> The browser runs a Next.js frontend. MapLibre is a frontend library inside that browser layer; it is not a backend service. MapLibre obtains base-map tiles from the configured tile provider. For application data, the browser calls the Express API under `/api/v1`.
>
> Express is the only data-owning service. It validates requests, uses Prisma to access one PostgreSQL 18 database with PostGIS, and stores processed evidence files in a separate persistent uploads volume. A one-shot migration container applies the Prisma migrations before Express starts.
>
> The second backend service is FastAPI. At this milestone it exposes only health and readiness routes. It has no triage route, no AI model, no provider credentials, no database, and no call from the reporting flow. I show it because it exists, but I keep it outside the critical path and mark AI triage as disabled.

**Point at the two P0 feature groups while saying:**

> Report creation is browser to Express to PostgreSQL. The owner's evidence history reads those rows and protected image bytes back through Express. Map retrieval also goes through Express to the same persisted `flood_reports` rows. There is no frontend-to-database access, no public upload path, and no hidden duplication between services.

**Exact transition:**

> Now that component ownership is clear, I will show the small schema that supports this flow.

### 1:35-2:25 — Correct schema and ownership

**Show:** Simplified ER diagram.

**Say:**

> All application tables are in one PostgreSQL database and are managed by Express through its private Prisma data-access layer. The AI service owns no tables.
>
> The core entity is `FloodReport`. Its important fields are the generated UUID, reporter ID, category, required description, reported severity, latitude, longitude, location source, captured and submitted timestamps, verification status, evidence path, and the generated PostGIS point. `User` has a one-to-many relationship with `FloodReport`. An existing optional incident relation is present, but a newly submitted Milestone 2 report is not automatically aggregated into an incident.
>
> Coordinates have database checks, the description is constrained to 10 through 1,000 trimmed characters, and the PostGIS point is generated from longitude first and latitude second using SRID 4326. The map uses a GiST index for bounded spatial reads.

**Exact transition:**

> The schema is deliberately narrow; next I will create one real row through the wireframe.

### 2:25-4:20 — Submit a real report

**Show:** Browser map, then click **Submit Flood Report**.

**Say while moving to the form:**

> The protected navigation exposes Reports Map, My Reports, and Submit Flood Report. My Reports and Submit Flood Report are two views of the reporting workflow, not separate core features. Authentication is required because every report has a real reporter relationship and both the history and map endpoints are account-aware.

**Action:** Choose a category and reported severity. Enter a unique description of at least 10 characters, for example: “Water covers both lanes beside the metro station at 10:30.”

**Say:**

> The frontend validates the same core concepts as the backend, but the backend remains authoritative. Description, severity, coordinates, location-source rules, timestamp, and image are validated again by Express, and the database adds its own constraints.

**Action:** Choose one prepared evidence image. Click the map once to place the temporary pin. Pause on the displayed coordinates.

**Say:**

> This click gives MapLibre latitude and longitude. For GeoJSON display the code uses longitude then latitude. For the API, it sends named latitude and longitude fields. Manual selection sends `locationSource` as `MANUAL` and no GPS accuracy; device location sends `DEVICE_GPS` with a positive accuracy value.

**Action:** Click **Submit Flood Report** once.

**Say while it submits:**

> The button is disabled and an in-memory guard prevents duplicate submissions. The frontend sends authenticated multipart data to `POST /api/v1/reports`. Express validates and re-encodes the image, stores it under an opaque key, and creates the report plus a `REPORT_CREATED` audit row in a database transaction.

**Pause on the success state. Point to the ID, status, and coordinates.**

> This is the actual `201` response from the backend, not a frontend-generated placeholder. It contains the database UUID, `SUBMITTED` status, and the stored coordinates. `SUBMITTED` explicitly means unverified.

**Exact transition:**

> The API has now returned the stored record. I will first show the owner's persisted evidence history, then follow that exact ID and location to the map.

### 4:20-5:45 — Review persisted evidence and inspect the marker

**Action:** Click **View submitted reports**.

**Say:**

> My Reports calls authenticated `GET /api/v1/users/me/reports`, so this history is scoped to the signed-in reporter. Each visible card then requests its evidence through the separately authorized `GET /api/v1/reports/:reportId/image` endpoint. The browser receives private image bytes; it never receives a public file path or the opaque storage key.

**Action:** Point to the new report, its evidence photo, status, description, and coordinates. Then click **Show on map**.

**Say:**

> The map link carries the created report ID and coordinates only to center and select the result. The marker itself is not reconstructed from that link. The map performs an authenticated `GET /api/v1/reports/map` with a bounded geographic box and renders the returned records.

**Action:** Point to the report count and highlighted marker. Click the marker if it is not already selected.

> The map response is privacy-limited: ID, category, reported severity, coordinates, timestamps, status, incident ID, and whether this actor can view details. It excludes the reporter identity, image path, and description. Because I own this report, the UI separately calls `GET /api/v1/reports/:reportId` and shows the stored description in the detail panel.

**Action:** Point to the visible severity label, status, coordinates, timestamp, and description.

> Marker color is only a supporting cue. The panel also states the severity and status in text, and the safety notice says that submitted evidence is unverified.

**Action:** Refresh the browser, wait for session restoration, and reopen the marker if necessary.

> After refresh the report still exists because PostgreSQL and the uploads volume are persistent. The map is reading it again from the backend; it is not a hard-coded reports array.

**Exact transition:**

> The live UI proves the behavior; now I will show the automated evidence behind the same path.

### 5:45-6:40 — Verification evidence

**Show:** Terminal with successful preflight output and, if requested, the two targeted test files.

**Say:**

> The tested Milestone 2 preflight command is `node --env-file=.env scripts/milestone2-preflight.mjs --write-flow`. It passed frontend health, backend readiness, and the health-only FastAPI check, then persisted a real multipart report and returned the same ID and exact coordinates through `/reports/map`. When optional demo credentials are absent, it registers an isolated preflight user automatically; no manual credential loading is required.
>
> The backend integration suite also creates a report, checks the persisted Prisma row, reads it through the owner list and map endpoints, authorizes its image and detail, and repeats the map read to represent refresh. The frontend integration suite checks location selection, duplicate-click prevention, owner evidence history and protected image loading, persisted map results, marker detail, and the empty states.
>
> A real Chromium vertical-slice test also registered and signed in a user, selected a map point, uploaded evidence, submitted the report, verified its marker and stored detail, and reloaded the page to prove the marker persisted.

**Exact transition:**

> I will close with the exact project boundary and the work I am deliberately not claiming.

### 6:40-7:20 — Honest limitations and close

**Say:**

> The current milestone does not provide AI triage, automatic incident aggregation, route planning, live sensors, authority dashboards, or emergency verification. The FastAPI service is health-only and AI triage is disabled. Reports are community evidence and begin as unverified.
>
> The recovery from the previous milestone is architectural clarity: one clear data owner, one schema source of truth, one persisted report flow, and one map read flow. The demonstrated result is small, but every box and arrow corresponds to code that exists and behavior that can be tested.

**Final sentence:**

> That completes the two Milestone 2 features: create one real geotagged report, then retrieve and display that same persisted report on the map.

## Exact transition lines only

Memorize these six lines:

1. “I will begin with the corrected architecture, because every later screen follows this same request path.”
2. “Now that component ownership is clear, I will show the small schema that supports this flow.”
3. “The schema is deliberately narrow; next I will create one real row through the wireframe.”
4. “The API has now returned the stored record; I will follow that exact ID and location to the map.”
5. “The live UI proves the behavior; now I will show the automated evidence behind the same path.”
6. “I will close with the exact project boundary and the work I am deliberately not claiming.”

## 60-second emergency script

Use this if live-demo time is removed or the browser cannot be used. Show the architecture and schema, then the last successful preflight output. If showing screenshots, call them previously captured evidence rather than a live system.

> FloodReady Milestone 2 is intentionally limited to two working features. The reporting workflow lets a signed-in user submit a category, required description, reported severity, evidence image, and map-selected location, then review that persisted record and its protected photo in owner-only evidence history. The reports-map feature calls authenticated `/api/v1/reports/map`, receives a privacy-safe projection, and places the same row using longitude-latitude GeoJSON order. Selecting the marker can fetch the protected stored description for its owner. Refresh reads the database row again, so the marker remains. Express owns all report data and image access; FastAPI is health-only and AI triage is disabled.

## 15-second interruption answer

> The core result is simple: Express exclusively owns report data and evidence access. `POST /reports` creates a geotagged row, the owner-only history securely shows its photo, and `GET /reports/map` reads that same row for MapLibre. AI triage is disabled and outside the P0 path.
