# Archived demo checklist

> Superseded by [10-demo-checklist.md](10-demo-checklist.md). Do not use this file for the current presentation.

Use this from the repository root on the presentation laptop. The canonical deployment is the root `docker-compose.yml`; do **not** use `backend/docker-compose.yml` for the full-stack demo.

## Demo contract

- [ ] Only claim two core features: the reporting workflow creates a report and shows its owner-only evidence history; the map feature retrieves and displays that same persisted report.
- [ ] Present only `/reports/new`, `/reports`, and `/map`; explain that the first two routes are views of one reporting-workflow feature. Complete authentication before the audience sees the browser.
- [ ] AI triage is **DISABLED**. FastAPI is health-only and is not required by the P0 report flow.
- [ ] Use a signed-in account. Anonymous submission is not implemented.
- [ ] Use one non-sensitive JPEG, PNG, or WebP image under the configured size limit.
- [ ] Call severity “reported” or “claimed,” and status `SUBMITTED` “unverified.”
- [ ] Do not claim automatic incident creation, route planning, sensors, analytics, or official emergency verification.

## One day before

### 1. Freeze and identify the build

- [ ] Record the branch and commit intended for presentation.
- [ ] Confirm no unexpected local files will be included:

```powershell
git status --short --branch
git log -1 --oneline
```

- [ ] Do not open, print, commit, or screen-share `.env`, `frontend/.env.local`, generated acceptance credentials, access tokens, or passwords.

### 2. Verify environment inputs

- [ ] Root `.env` exists and contains real non-placeholder secrets.
- [ ] `DATABASE_URL` uses Compose DNS: host `db`, port `5432`.
- [ ] `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1`.
- [ ] `INTERNAL_API_BASE_URL=http://backend:3000/api/v1` for the Compose build.
- [ ] Map style URL, connect/image origins, attribution, and default coordinates describe the same provider and location.
- [ ] The root `.env` is the Compose configuration source. The validator does not depend on a developer `frontend/.env.local` file.

Run the source, environment, and Compose parsers:

```powershell
node scripts/check-source.mjs
node scripts/verify-compose.mjs --env-file .env
docker compose --env-file .env config --quiet
```

All three must pass before presentation day. If `verify-compose.mjs` reports frontend drift, resolve the environment mismatch; do not dismiss it during the presentation.

### 3. Run targeted P0 tests

```powershell
Push-Location backend
npm test -- milestone2-report-map
Pop-Location

Push-Location frontend
npm test -- milestone2-wireframes
Pop-Location

ai-service\.venv\Scripts\python.exe -m pytest -q ai-service\tests
```

- [ ] Backend test creates a real row in an isolated migrated PostGIS database and returns it through owner-list, protected-image, map, and detail reads.
- [ ] Frontend tests cover map selection, one-call submission, owner evidence history and image loading, success targeting, marker detail, and empty states.
- [ ] AI tests are described only as health-service tests, not triage tests.

For the broader quality gates when time permits:

```powershell
Push-Location backend
npm run verify
Pop-Location

Push-Location frontend
npm run verify
Pop-Location
```

### 4. Build current container images

```powershell
docker compose --env-file .env build backend migrate ai-service frontend
```

- [ ] Build completes from the exact presentation checkout.
- [ ] Docker Desktop is configured not to sleep during the presentation.

## Canonical full-stack startup

Run these commands from the repository root in this order:

```powershell
docker compose --env-file .env up --detach --wait --wait-timeout 180 db
docker compose --env-file .env run --rm --no-deps migrate
docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend ai-service frontend
docker compose --env-file .env ps
```

What this proves:

1. `db` starts PostgreSQL/PostGIS and waits for `pg_isready`.
2. `migrate` runs `prisma migrate deploy`, including the ordered `20260713000000_normalize_legacy_report_descriptions` compatibility step before `20260714000000_milestone2_required_description` when not yet applied.
3. Express, health-only FastAPI, and Next.js start from the current images.
4. `--wait` requires their configured health checks to become healthy.

Do not substitute `prisma db push`, manually edit tables, or skip migrations.

### Optional clearly labelled demo seed

The fixed demo dataset is available only when the demo seed variables are intentionally configured. It is useful for a backup walkthrough, but it is **not** evidence for the P0 report-to-map write/read proof:

```powershell
docker compose --env-file .env --profile demo run --rm demo-seed
```

Keep `DEMO_SEED_ENABLED=false` for the main live proof. Prefer the isolated preflight user and a newly submitted report; never describe fixed seed records as live user submissions.

## Route checks

Run these without displaying secrets:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/v1/health
Invoke-RestMethod http://127.0.0.1:3001/api/v1/health/ready
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/health/ready
```

Expected route responsibilities:

| Route | Purpose |
|---|---|
| `GET http://127.0.0.1:3000/api/health` | Next.js liveness only |
| `GET /api/v1/health` | Express liveness |
| `GET /api/v1/health/ready` | Express database and upload-volume readiness |
| `POST /api/v1/auth/login` | Obtain a session before the presented browser flow |
| `POST /api/v1/reports` | Authenticated multipart report creation |
| `GET /api/v1/users/me/reports?limit=12&sort=desc` | Authenticated owner-only submitted-report history |
| `GET /api/v1/reports/:reportId/image` | Authorized private evidence-image bytes; no public storage path |
| `GET /api/v1/reports/map?west=...&south=...&east=...&north=...` | Authenticated persisted marker read |
| `GET /api/v1/reports/:reportId` | Owner/moderator full stored detail |
| `GET /health`, `GET /health/ready` on port 8000 | FastAPI health only; no triage |

## Milestone 2 preflight

Run the tested canonical command from the repository root. Node loads the root environment file directly; no manual environment or credential-loading step is required.

```powershell
node --env-file=.env scripts/milestone2-preflight.mjs --write-flow
```

When `M2_DEMO_EMAIL` and `M2_DEMO_PASSWORD` are both absent, the script registers an isolated preflight user automatically. If an existing test account is intentionally configured, set both optional values in `.env`; supplying only one is an error.

The live preflight passed all three health checks and the persisted-report-to-map-marker assertion. Expected output includes PASS lines for frontend, backend, `AI service (health-only; triage disabled)`, isolated-user registration or login, and `PASS persisted report -> map marker: <uuid>`.

- [ ] Output includes `PASS persisted report -> map marker: <uuid>`.
- [ ] Save the UUID in private presenter notes, not on a public slide.
- [ ] Remember that `--write-flow` creates a genuine persisted report and does not delete it.
- [ ] Run it once during final rehearsal rather than repeatedly filling the map.

## Prepare the browser session and evidence

- [ ] Complete authentication before screen sharing; begin the presented browser flow on `/map`.
- [ ] Refresh `/map` once to verify the refresh cookie restores the session.
- [ ] Use an ordinary `USER` session; moderator/admin privileges are unnecessary.
- [ ] Prepare one small, non-sensitive evidence image with a simple filename.
- [ ] Do not use a real emergency claim, identifiable victim, private address, or misleading image.
- [ ] Use a unique description containing the current time so the new report is easy to identify.

## Full rehearsal: exact click path

1. [ ] Open `http://localhost:3000/map` while signed in.
2. [ ] Point out **Reports Map**, the safety notice, real persisted count, Refresh, and **Submit Flood Report**.
3. [ ] Click **Submit Flood Report**.
4. [ ] Select category and reported severity.
5. [ ] Enter 10–1,000 characters of unique description.
6. [ ] Choose exactly one valid image.
7. [ ] Click the map once and point to the temporary pin and coordinates.
8. [ ] Click **Submit Flood Report** once.
9. [ ] On success, point to backend UUID, `SUBMITTED` status, latitude, and longitude.
10. [ ] Click **View submitted reports**.
11. [ ] In **My Reports**, point to the new record, its protected evidence photo, status, description, and coordinates.
12. [ ] Click **Show on map** on that card.
13. [ ] Wait for the map count and highlighted marker.
14. [ ] Select the marker and point to category, reported severity, status, coordinates, timestamp, and stored description.
15. [ ] Refresh the browser; wait for session restoration and reopen the marker if necessary.
16. [ ] State: “This refresh performs a new backend read; the marker is not a hard-coded frontend object.”

## Fifteen minutes before presenting

- [ ] Connect laptop power and disable sleep, notifications, updates, and screen savers.
- [ ] Confirm internet access for the external tile provider.
- [ ] Close unrelated tabs, terminals, editors, messages, and credential files.
- [ ] Run `docker compose --env-file .env ps`; `db`, `backend`, `ai-service`, and `frontend` should be healthy.
- [ ] Run the five health probes.
- [ ] Run `node --env-file=.env scripts/milestone2-preflight.mjs --write-flow` once and confirm the tested PASS sequence.
- [ ] Open architecture, schema, script, map, and terminal evidence in the correct order.
- [ ] Sign in and leave the browser on `/map`.
- [ ] Keep the evidence image in an easy-to-find folder.
- [ ] Set browser zoom to a readable value and test the projector resolution.
- [ ] Keep `ONE_PAGE_CHEATSHEET.md` open privately.

## Backup path with AI unavailable

The P0 UI does not call FastAPI. If the health-only AI container fails, do not delay or fake AI; run the core stack without it:

```powershell
docker compose --env-file .env up --detach --wait --wait-timeout 180 db
docker compose --env-file .env run --rm --no-deps migrate
docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend frontend
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/v1/health/ready
```

Then perform the same UI creation/map flow. Say exactly:

> The optional FastAPI container is unavailable, but it is health-only and AI triage is disabled. The two P0 features do not call it; I am demonstrating the independent persisted report path.

Current limitation: `scripts/milestone2-preflight.mjs` always probes FastAPI before its optional write flow, so that script is expected to fail when FastAPI is down. Use the direct frontend/backend health probes and the already recorded successful write-flow evidence; never relabel a failed preflight as a pass.

## Recovery table

| Symptom | Safe response |
|---|---|
| Container not healthy | `docker compose --env-file .env ps`, then `docker compose --env-file .env logs --tail 100 db backend frontend ai-service` |
| Backend not ready | Confirm `db` is healthy, rerun `docker compose --env-file .env run --rm --no-deps migrate`, then restart backend |
| Frontend stale after code change | Rebuild `frontend`, then recreate only that service |
| Login fails | Verify backend readiness and credentials; register a fresh presentation user if needed |
| Session disappears on refresh | Sign in again; do not continue with an anonymous-state claim |
| Form rejects submission | Check 10-character description, one image, category/severity, and selected map point |
| My Reports image is unavailable | Retry the image, then verify backend readiness, the uploads volume, and that the signed-in account owns the report |
| Marker not immediately visible | Use the success link, wait for the map request, click Refresh, and confirm the report coordinates are inside the displayed area |
| Base map fails | State the tile-provider issue; show API/preflight and test evidence. Do not call a screenshot live output |
| AI health fails | Use the documented P0-without-AI path; say triage is disabled |

Useful recovery commands:

```powershell
docker compose --env-file .env logs --tail 100 db backend frontend ai-service
docker compose --env-file .env restart backend frontend
docker compose --env-file .env run --rm --no-deps migrate
```

## Safe restart versus destructive reset

### Safe restart that preserves reports and uploads

```powershell
docker compose --env-file .env down --remove-orphans
docker compose --env-file .env up --detach --wait --wait-timeout 180 db
docker compose --env-file .env run --rm --no-deps migrate
docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend ai-service frontend
```

Named volumes remain, so reports, users, refresh sessions, and processed images persist.

### Destructive reset — last resort only

```powershell
docker compose --env-file .env down --volumes --remove-orphans
```

This deletes the PostgreSQL and uploads volumes, including every user, report, session, audit row, and evidence file. Never run it during the presentation or final rehearsal. If it is deliberately run earlier, rebuild/start, apply migrations, restore a signed-in browser session, rerun the canonical preflight (which can register an isolated test user automatically), and rehearse again from the beginning.

## Final go/no-go decision

Proceed with the live demo only when all are true:

- [ ] Root Compose services required for P0 are healthy.
- [ ] Latest migration applied successfully.
- [ ] Presentation login works after refresh.
- [ ] One manual report creation succeeded today.
- [ ] That report and its evidence photo appeared in the signed-in user's **My Reports** history.
- [ ] That exact report appeared through `/reports/map` with matching coordinates.
- [ ] Marker detail showed the stored description.
- [ ] You can deliver the 60-second emergency version without claiming a live run.
- [ ] You are ready to say plainly: **“AI triage is disabled; FastAPI is health-only.”**
