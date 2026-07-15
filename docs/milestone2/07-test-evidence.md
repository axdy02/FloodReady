# Archived test evidence

> Superseded by [07-testing-evidence.md](07-testing-evidence.md). Do not use this file for the current presentation.

**Final verification date:** 14 July 2026  
**Target flow:** authenticated report submission -> PostgreSQL/PostGIS persistence -> owner-only evidence history and protected photo -> reports-map retrieval -> MapLibre marker -> stored detail -> refresh persistence  
**AI status:** **DISABLED**. The FastAPI service exposes health/readiness only and is outside the report data path.

This document records commands that were actually executed against the final working tree. A PASS is not inferred from source inspection.

## Final command results

| Area | Command | Final result |
|---|---|---|
| Frontend complete gate | `cd frontend; npm run verify` | **PASS** — lint, source policy, TypeScript, coverage tests, and production test build all completed. |
| Frontend tests | Included in `npm run verify` as `vitest run --coverage` | **PASS** — 17 test files, 47 tests. |
| Frontend coverage | Included in `npm run verify` | **PASS** — statements 88.33%, branches 80.71%, functions 88.53%, lines 92.71%; required thresholds are 85%, 80%, 85%, and 85%. |
| Frontend production build | Included in `npm run verify` as `npm run build:test` | **PASS** — Next.js compiled, type-checked, generated its static page data, and emitted the application route table. |
| Browser vertical slice | `cd frontend; npm run test:e2e -- --project=desktop` | **PASS** — 1 Chromium test in 5.1 seconds (7.6 seconds total), including a real rendered-marker click. |
| Backend complete gate | `cd backend; npm run verify` | **PASS** — lint, source policy, TypeScript, Prisma validation, build, fresh migrated PostGIS test database, and tests all completed. |
| Backend tests | Included in `npm run verify` | **PASS** — 15 test files, 54 tests, with all four migrations applied to a fresh PostgreSQL/PostGIS database. |
| Legacy migration upgrade | Isolated `postgis/postgis:18-3.6` container; apply the first two migrations, insert short/null/blank legacy descriptions, then apply `20260713000000` and `20260714000000` | **PASS** — all three rows were preserved and normalized; the 10-1,000 check and NOT NULL constraint then applied. |
| FastAPI tests | `cd ai-service; .venv/Scripts/python.exe -m pytest` | **PASS** — 15 tests. |
| FastAPI lint | `cd ai-service; .venv/Scripts/python.exe -m ruff check .` | **PASS** — all checks passed. |
| FastAPI type check | `cd ai-service; .venv/Scripts/python.exe -m mypy app tests` | **PASS** — 23 source files. |
| Formatting | No formatter script is defined in the repository manifests | **N/A** — lint, type checks, source policy, and `git diff --check` are the available style gates. |
| Root source policy | `node scripts/check-source.mjs` | **PASS** — 10 scanned files, 0 violations. |
| Compose environment | `node scripts/verify-compose.mjs --env-file .env` | **PASS**. |
| Example environment | `node scripts/verify-compose.mjs --env-file .env.example` | **PASS**. |
| Compose validation | `docker compose --env-file .env config --quiet` | **PASS**. |
| Container build | `docker compose --env-file .env build` | **PASS** — frontend, Node backend, and FastAPI images built. |
| Development migration | `docker compose --env-file .env run --rm --no-deps migrate` | **PASS** — the new ordered legacy-normalization migration applied to the existing presentation database; all four migrations are current. |
| Stack startup | `docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend ai-service frontend` | **PASS**. |
| Final service state | `docker compose --env-file .env ps` | **PASS** — database, Node backend, health-only FastAPI, and frontend all healthy. |
| Live write/read proof | `node --env-file=.env scripts/milestone2-preflight.mjs --write-flow` | **PASS** — health checks passed, an isolated user was registered, a real report was created, and the map query returned the same ID and exact coordinates. Final proof ID: `deccdcee-416f-4e38-bd67-82ccf07c6641`. |
| Preflight syntax | `node --check scripts/milestone2-preflight.mjs` | **PASS**. |
| Patch hygiene | `git diff --check` | **PASS** — no whitespace errors; Git printed only Windows line-ending conversion notices. |
| Diagram parse | XML parsing of both presentation SVG files | **PASS**. |

The Chromium browser binary required by the pinned Playwright version was installed with `npx playwright install chromium` before the final browser run.

## What the browser test proves

`frontend/e2e/milestone2-report-map.spec.ts` drives the actual browser flow against the Compose services:

1. Register an isolated user.
2. Preserve the requested return path through registration and login.
3. Sign in through the real authentication API.
4. Open `/reports/new`.
5. Click the MapLibre location picker and verify coordinates are captured.
6. Attach a real PNG and submit the multipart form.
7. Open `/reports`, locate the created record by its unique description, and render its evidence through the protected image endpoint as a readable blob.
8. Run a WCAG A/AA accessibility scan of the evidence-history content.
9. Reload `/reports` and verify both the report and evidence photo are still retrieved from persistent storage.
10. Use the report card's map link to open `/map` at the created report.
11. Close URL-selected detail, click the actual rendered MapLibre marker at the submitted coordinates, and verify its popup/detail match.
12. Reload the map and verify the persisted marker remains.
13. Fail for page errors or unexpected console errors during the authenticated P0 flow.

The test replaces only the external basemap style request with the repository's deterministic blank style fixture. Report creation, authentication, API calls, database persistence, map DTO retrieval, GeoJSON marker rendering, and the detail read remain real. External OpenFreeMap availability is checked at presentation time through the live demo rather than treated as an application data source.

`frontend/src/features/map/map-canvas.tsx` is the only file excluded from Vitest's unit-coverage calculation because jsdom does not provide the WebGL runtime it adapts. The passing Chromium test exercises that real adapter, renders the GeoJSON report layer, and clicks its marker; the exclusion does not mean the path is untested.

## Backend/data acceptance evidence

`backend/tests/integration/milestone2-report-map.test.ts` runs against a fresh migrated PostGIS database and proves:

- a valid multipart report receives HTTP 201 and a real UUID;
- the same UUID exists in `flood_reports` with the submitted description and coordinates;
- the map endpoint returns that persisted UUID and exact coordinates;
- the protected detail endpoint returns the stored description;
- a second map read still returns the report;
- short descriptions, invalid severity, invalid latitude, invalid longitude, and missing location are rejected without a persisted row.

The wider backend suite also covers the owner-scoped report list, authorized private image retrieval, denial for another ordinary user, empty map results, status filtering, timestamp/DTO behavior, database failure handling, image validation, and the correct longitude/latitude spatial conversion.

## Defects caught during verification

- The backend missing-environment test was accidentally reading the developer `.env`; the test now uses an intentionally missing dotenv path.
- The FastAPI launcher validated configured trusted hosts but constructed a different default app. It now launches the app created from the validated settings, with a regression test for accepted and rejected hosts.
- The first frontend coverage run exposed insufficient branch coverage around the new wireframe states. Focused integration cases were added; the unchanged thresholds now pass.
- The first browser attempt found the pinned Chromium binary missing. The binary was installed, the flow was rerun, and the final test passed.
- The browser test initially treated the expected anonymous refresh attempt before login as an application error. It now explicitly permits only that expected 401, clears it, and enforces zero unexpected errors during the authenticated P0 flow.
- A legacy nonblank description shorter than 10 characters could have blocked the new database check. An earlier ordered migration now preserves and labels such rows; an isolated old-schema-to-new-schema PostGIS upgrade test passed.
- Long-lived map queries captured the access token that existed when the hook rendered. Query executions now read the current token, and a regression test proves a refetch uses the refreshed token.

## Known non-blocking warnings

- Docker's frontend dependency install reported two moderate npm audit findings. No forced dependency upgrade was applied immediately before the presentation; lint, tests, coverage, and production build still pass.
- FastAPI tests emit a Starlette deprecation warning about `TestClient`/httpx integration. It does not affect health endpoints or the passing tests.
- Playwright prints a `NO_COLOR`/`FORCE_COLOR` environment warning. It does not affect the test result.
- Chromium can print WebGL GPU performance messages when reading pixels. They are driver/performance diagnostics, not page exceptions, and the final browser test passes.

## Live stack and automated browser result

The final Compose stack was healthy on the presentation machine at the end of verification:

- frontend: `http://localhost:3000`
- Node Report API: `http://localhost:3001`
- FastAPI health-only scaffold: `http://localhost:8000`
- PostgreSQL/PostGIS: internal Compose network only

The live preflight created a report through the Node API and recovered the same UUID and coordinates from `/api/v1/reports/map`. This is separate from unit mocks and proves the running container/database path.

The Chromium E2E completed the browser interaction path described above. This was an automated browser run, not a claim that the presenter's final manual rehearsal has already happened; the exact manual rehearsal remains in `09-demo-checklist.md` and should be performed immediately before presenting.

## Remaining genuine limitations

- AI triage is disabled because there is no provider-backed triage endpoint, model configuration, structured result contract, UI integration, or persistence metadata. Manual P0 reporting is unaffected.
- The reports map queries a bounded box around the configured center or created-report coordinates; it does not refetch after every pan or zoom.
- Evidence files use durable local single-node Docker storage rather than object storage.
- The configured OpenFreeMap/OSM basemap requires internet access; application report data remains in PostgreSQL if the basemap is unavailable.
- An interrupted POST can complete after the browser loses the response. The form therefore labels the outcome as unknown and tells the user to check the map before retrying.
- Authentication is required for both submission and report-map access in the current architecture.

## Readiness conclusion

**READY WITHOUT AI.** Both P0 features pass automated frontend, backend, browser, migration, build, Compose health, and live persisted write/read checks. AI is deliberately hidden and documented as future scope rather than simulated.
