# FloodReady Milestone 1 Backend

FloodReady is a Node.js 24.18.0, npm 11.16.0, Express 5, TypeScript, PostgreSQL 18, and PostGIS 3.6 API. The API is versioned under `/api/v1`. It is structured by route, controller, service, repository, validation, and explicit safe DTO boundaries. Prisma uses its PostgreSQL driver adapter; PostGIS geography columns and parameterized raw queries provide bounded geospatial reads.

## Prerequisites

Install Node 24.18.0, npm 11.16.0, and Docker with Docker Compose. Docker is required for the isolated PostGIS test runner and the Compose deployment path. Use a PostgreSQL 18/PostGIS 3.6 database for non-container local development.

## Local setup

Copy `.env.example` to an uncommitted `.env`, replace every placeholder, and set a real PostgreSQL `DATABASE_URL`. Generate each JWT secret independently with:

```text
node -e "process.stdout.write(require('node:crypto').randomBytes(64).toString('base64url'))"
```

Use `npm ci`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run prisma:migrate:deploy`, and `npm run build`. `npm run dev` starts the TypeScript server; `npm start` runs the compiled server. `npm run prisma:migrate:dev` is for creating a local development migration. `npm run prisma:seed` creates an administrator only when all three `SEED_ADMIN_*` variables are supplied and the normalized email does not already exist.

Environment validation is fail-fast. Required runtime settings cover database pool/timeouts, two distinct base64url JWT secrets, token lifetimes, issuer/audience, exact origins, cookie domain, upload bounds, limiter bounds, login-locking bounds, proxy hops, shutdown timeout, and log level. `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are Compose interpolation values. `TEST_DATABASE_URL` is required only in a test process and must name an `_test` database. Do not commit `.env`, acceptance files, image uploads, or generated Prisma output.

## Tests and verification

`npm test` uses `scripts/test-runner.mjs`. It creates an ephemeral PostGIS 18 container, generates ignored random test credentials, checks the `_test` database guard, applies migrations, and runs Vitest with a temporary upload directory. It deletes the container and temporary files when finished. `npm test -- database` runs the database contract selection through the same lifecycle. `npm run test:watch` keeps that isolated container for a Vitest watch session.

`npm run lint` enforces zero warnings. `npm run quality:source` uses the TypeScript AST/trivia source gate to reject comments, unsafe casts and raw queries, direct environment access outside the permitted boundary, focused/skipped tests, and other prohibited constructs. `npm run typecheck`, `npm run prisma:validate`, `npm run build`, and `npm run verify` provide the normal local gates. Full acceptance is exactly:

```text
npm ci
npm run acceptance
```

The acceptance runner executes static gates, Prisma validation, build, real isolated tests/migration, Compose validation, a no-cache image build, Compose startup, both health probes, service-health checks, and a numeric non-root UID check. It creates and removes an ignored, per-run Compose project and credentials.

## Fictional demo seed

The demo seed is development/test-only and requires `DEMO_SEED_ENABLED=true` plus three ignored, pairwise-distinct passwords supplied in the environment. It creates only the fixed fictional `.invalid` identities, reports, incidents, audits, links, and deterministic images described by the reviewed location file. It never truncates unrelated data or exposes credentials.

```text
npm run prisma:seed:demo -- --manifest-json
npm run build:demo-seed
```

## Docker deployment

Run `docker compose --env-file .env config`, then `docker compose --env-file .env up -d`. Compose has `db`, one-shot `migrate`, and `backend` services. The backend waits for a healthy database and a successful migration. PostgreSQL 18 data persists in `postgres_data` at `/var/lib/postgresql`; uploads persist separately at `/app/uploads`. The API is loopback-bound on port 3000. The backend runs as UID/GID 10001 with a read-only root filesystem, writable upload volume, temporary `/tmp`, dropped capabilities, and no-new-privileges. Uploads are never statically mounted or publicly served.

## API contract

Every JSON success response is `{ success: true, data, requestId }`. Collections put `items` and `{ limit, hasMore, nextCursor }` inside `data`. Every error is `{ success: false, error: { code, message, details }, requestId }`; validation details contain only a path and `Invalid value`. Requests accept a valid UUID `X-Request-Id` or receive a generated one.

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/ready` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/PATCH /users/me`, `GET /users`, `GET/PATCH /users/:userId` |
| Reports | `POST /reports`, `GET /reports`, `GET /reports/map`, `GET/PATCH /reports/:reportId`, `GET /reports/:reportId/image`, `PATCH /reports/:reportId/status`, `GET /users/me/reports` |
| Incidents | `GET /incidents`, `GET /incidents/:incidentId` |

All endpoints are beneath `/api/v1`. Auth, users, and reports use `Cache-Control: no-store`. JSON endpoints require JSON; report creation requires bounded multipart form data. Report, own-report, report-map, and incident collections include filter-matching `totalCount` with keyset pagination. The administrator users collection remains unchanged.

## Authentication and authorization

Registration creates an active `USER` and audit event, but no session. Login uses Argon2id, an IP limiter, persistent per-account locking, one verification for each credential attempt, and a live database role. Access JWTs are HS512 bearer tokens intended only for in-memory client use. Never store access tokens in localStorage or sessionStorage.

Login and refresh set `floodready_refresh`, an HttpOnly, SameSite Strict cookie scoped to `/api/v1/auth`; production also sets Secure and the configured cookie domain. Refresh tokens are SHA-256 hashed at rest. Each refresh atomically rotates a fixed-expiry family. Replay revokes the active family, writes the reuse audit event, clears the cookie, and returns the generic refresh error. Logout is idempotent, revokes an active family when present, and clears the identical cookie attributes. Production refresh and logout require an exact allowed Origin; cross-site frontends are unsupported.

Anonymous callers may read health and incidents. Authenticated users may read themselves and their own reports. `MODERATOR` and `ADMIN` may list/read reports and moderate status transitions. Only `ADMIN` may list, read, or update users. A non-owner requesting a report receives 404 rather than an ownership disclosure. Inactive accounts fail every protected request. User and report collections use bounded keyset cursors tied to normalized filters; own-report cursors also bind to the current user.

## Reports, images, and geospatial data

Report creation accepts exactly one JPEG, PNG, or WebP image and strict location metadata. Legacy requests without `locationSource` are DEVICE_GPS and require positive accuracy. Explicit DEVICE_GPS also requires accuracy; MANUAL must omit it. The backend limits multipart parts and bytes, authenticates before parsing, limits both IP and user buckets, queues bounded image work, verifies detected bytes against client MIME, decodes with Sharp, auto-rotates, strips metadata, re-encodes, and stores only a server-generated opaque relative key. A successful transaction creates a `SUBMITTED`, `WEB` report with no incident and one `REPORT_CREATED` audit entry. Responses never contain an image path, key, hash, filesystem path, token, or session record.

`GET /reports/map` requires authentication, all four bounded bbox query fields, and a per-user 60-request/15-minute limiter in addition to the general IP limiter. It excludes rejected reports and returns only the privacy-safe marker projection. `GET /reports/:reportId/image` uses the same authorization and non-disclosure rule as report detail, streams the processed bytes with private no-store headers, and never exposes a storage path or key. Incident responses include `reportCount`, labeled by clients as linked reports rather than verification.

Latitude and longitude are scalar decimal columns plus generated PostGIS `geography(Point,4326)` values with GiST indexes. Reports and incidents accept inclusive, non-antimeridian bounding boxes through parameterized `ST_MakeEnvelope` geography predicates. Incidents are public and read-only; there is no automated incident creation, verification, or report linking.

`GET /health` is dependency-independent liveness. `GET /health/ready` probes a dedicated one-client PostgreSQL/PostGIS pool and upload-directory write access, returning only a generic 503 on failure. On termination, the server drains HTTP work, disconnects Prisma, forces remaining connections closed on timeout, and treats a second termination signal as failure.

## Milestone 1 limitations

- Local single-node storage only; no S3 implementation.
- No public upload serving or unauthenticated image retrieval.
- In-process network rate limits and a single backend replica; persistent login locking survives restarts.
- No virus scanner beyond strict image decode and re-encode.
- No background orphan reconciliation after an OS-level cleanup failure.
- Read-only incidents with no automated incident creation, verification, or linking.
- No password recovery, email verification, MFA, social login, account deletion, or frontend.
- No AI, ML, scoring, inference, or placeholder AI service.
