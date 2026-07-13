# FloodReady Milestone 1 Compatibility Report

## Scope and evidence

This report records the repository state inspected for WP00 on 2026-07-12. It is descriptive only: no application, package, schema, Docker, or behavior change was made by WP00.

The root contains `MASTER_SPEC.md` and the existing `backend/` implementation. `frontend/`, `ai-service/`, root Compose files, root environment example, root scripts, root README, and the `docs/` tree were absent before this report was created. The root Git worktree is unavailable: `git status --short` returns `fatal: not a git repository`. Git history, cleanliness, reset, and rollback are therefore not evidence for this milestone.

The inspected backend contract is anchored by these SHA-256 fingerprints:

| Path | SHA-256 |
|---|---|
| `backend/package.json` | `28b0edd3507a7a3795d6c20454c5b6a1933562607b2078c8c0ba4185c6e144d6` |
| `backend/package-lock.json` | `e8838fee6fd37e3955e4f8c87261cbd2b9657e552d1a06024dd03daa3e2a2471` |
| `backend/prisma/schema.prisma` | `a35dae7a15c08e5ba68a0762149fd3c8015a937564c97c2ab91d0b8e9127c9ff` |
| `backend/src/config/env.ts` | `2e47a1b949d8b9d4b59587778586ddbc322d49234b1ba40b3513cd99556958d8` |
| `backend/src/routes/index.ts` | `16e5c323374cd7ef7891442ad537d6e254f8f779caefd17d518995c44681a491` |
| `backend/src/modules/reports/reports.routes.ts` | `d472fb05c3134eed6e0e85794602cac5e635844052cc04a362c6e86ca10c03fe` |
| `backend/src/modules/reports/reports.types.ts` | `5f3f3f4ee624e15cc709d2e6c7f428459a1fccf09797493a176da7ea110e0ec6` |
| `backend/src/modules/incidents/incidents.types.ts` | `11a5a9187e5fb713ef9ff79d264ded56bfee9d1c23501915b872ee64c12014b5` |
| `backend/src/shared/types/pagination.ts` | `7c3023c68c5b41d516a4b15fe616a034505d66fa811200ae3f4130182ecc7bc1` |
| `backend/src/shared/validation/cursor.ts` | `d03ad3600d22e95b03e8c1e6664a7728e3d45f4d3e02dd134126717f85eb1ec6` |

## Frozen backend contract

All API routes are mounted beneath `/api/v1` in `backend/src/routes/index.ts`. Success envelopes are `{ success: true, data, requestId }`; failures contain `code`, `message`, `details`, and `requestId`. Request IDs are validated or replaced by the existing middleware and tests.

Health exposes `GET /health` and `GET /health/ready`. Authentication exposes registration, login, refresh, logout, and Bearer-protected current-user read. Users expose Bearer-protected self read/update and ADMIN-only list/detail/update. Reports expose authenticated multipart create, MODERATOR/ADMIN list, owner-or-privileged detail, owner update, moderation, and own-report list. Incidents expose public list/detail. Route authorization is defined in the route modules; behavior is covered by the listed integration suites.

| Frontend-used contract | Authoritative source paths |
|---|---|
| Envelope, request ID, security headers, CORS, and API mount | `backend/src/app.ts`, `backend/src/routes/index.ts`, `backend/tests/integration/app-foundation.test.ts`, `backend/tests/integration/http-security.test.ts` |
| Health and readiness | `backend/src/modules/health/health.routes.ts`, `backend/tests/integration/health-runtime.test.ts` |
| Registration, login, refresh, logout, and current user | `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/auth/auth.types.ts`, `backend/src/modules/auth/auth.validation.ts`, `backend/tests/integration/auth-register-login.test.ts`, `backend/tests/integration/auth-refresh.test.ts` |
| User profile and administrator user endpoints | `backend/src/modules/users/users.routes.ts`, `backend/src/modules/users/users.types.ts`, `backend/src/modules/users/users.validation.ts`, `backend/tests/integration/users-me.test.ts`, `backend/tests/integration/users-admin.test.ts` |
| Report create, list, read, update, and moderation | `backend/src/modules/reports/reports.routes.ts`, `backend/src/modules/reports/reports.types.ts`, `backend/src/modules/reports/reports.validation.ts`, `backend/src/modules/reports/reports.upload.ts`, `backend/tests/integration/reports-create.test.ts`, `backend/tests/integration/reports-read-update.test.ts`, `backend/tests/integration/reports-moderation.test.ts` |
| Public incident list and detail | `backend/src/modules/incidents/incidents.routes.ts`, `backend/src/modules/incidents/incidents.types.ts`, `backend/src/modules/incidents/incidents.validation.ts`, `backend/tests/integration/incidents.test.ts` |
| Keyset pagination and opaque cursor rules | `backend/src/shared/types/pagination.ts`, `backend/src/shared/validation/cursor.ts`, `backend/tests/integration/contracts.ts` |
| Processed-image storage boundary | `backend/src/shared/storage/image-storage.ts`, `backend/src/shared/storage/local-image-storage.ts` |

`UserDto` contains id, name, email, role, active state, and timestamps. `AuthDto` contains a Bearer access token, expiry, and `UserDto`. `ReportDto` currently requires non-null `gpsAccuracy` and has no `locationSource`. `IncidentDto` currently has no `reportCount`. Existing report, incident, user, and own-report collections return `items` and cursor pagination only; the users collection must remain unchanged by later compatibility work.

The authoritative role enum is USER, MODERATOR, ADMIN. Report categories, severities, verification statuses, incident statuses, and moderation reasons match `backend/prisma/schema.prisma` and `backend/src/modules/reports/reports.types.ts`. Existing validation enforces strict JSON bodies, bounded keyset cursors, 1–100 list limits, bbox pairing/order, maximum 366-day time ranges, image metadata bounds, and moderation reason requirements. Current report creation requires a positive non-null GPS accuracy.

Refresh uses the HttpOnly, SameSite Strict `floodready_refresh` cookie scoped to `/api/v1/auth`; production origin checks and cookie-domain validation remain backend authority. Image upload accepts one bounded JPEG, PNG, or WebP, verifies decoded bytes, strips metadata through the processing path, and saves only an opaque server-generated key. Storage has save/delete operations and containment checks; no existing route retrieves report images.

## Required compatibility gaps

The following six Section 6.8 gaps are absent in the inspected implementation and are the only planned backend changes:

1. WP01: authenticated `GET /reports/map`, privacy-safe `ReportMapDto`, `reportMap` actor-bound cursor, bbox limits, and the user-keyed map limiter.
2. WP01: incident `reportCount`, exactly the count of linked reports.
3. WP01: `totalCount` for report, own-report, report-map, and incident collections. `KeysetPage` currently has no total field.
4. WP01: protected `GET /reports/:reportId/image`, including private no-store streaming and the required storage retrieval capability.
5. WP01: `LocationSource`, nullable accuracy, manual-location validation, DTO/type/repository changes, and the specified migration constraint. The current schema has non-null `gps_accuracy` and no location source.
6. WP14: development-only idempotent fictional demo seed. Current `backend/prisma/seed.ts` creates an administrator only when all legacy seed values are supplied.

No other backend compatibility change is authorized by WP01. Existing authorization, refresh-cookie handling, upload isolation, audit behavior, and admin user management remain frozen.

## Deferred external inputs

`MAP-INPUT-01` is pending: a reviewed MapLibre provider contract, attribution, permitted origins, and valid ignored `frontend/.env.local` values. It blocks WP07, WP08, WP15, WP17, and WP19 product PASS. `MAP-INPUT-02` is pending: approved `backend/prisma/demo-locations.json` with the matching default map coordinates and eight non-sensitive public-area points. It blocks WP07, WP08, WP14, WP15, WP17, WP18 demo claims, and WP19. Neither input blocks WP00 through WP06.

`DEMO-INPUT-03` is optional manual-demo evidence only. It does not block automated WP17 or WP19 evidence.

## Verification completed

`rg --files` confirmed every WP00 inspection path exists. From `backend/`, `npm ci`, `npm run lint`, `npm run quality:source`, and `npm run typecheck` completed successfully. The source-quality gate scanned 91 authored files and reported zero violations.
