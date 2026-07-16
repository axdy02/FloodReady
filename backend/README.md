# FloodReady Backend 1

Backend 1 is the Node.js/Express system of record for FloodReady. It owns authentication, report validation, private image storage, PostgreSQL/PostGIS persistence, report/map APIs, and the internal call to Backend 2 for advisory AI analysis.

It serves all public application APIs beneath `/api/v1`. In the root Compose stack it is exposed at `http://localhost:3001/api/v1`.

## Current report and AI flow

```text
POST /reports (authenticated multipart)
  -> validate and re-encode one image
  -> store private bytes in uploads_data
  -> transaction: flood_reports + ai_analyses(PROCESSING) + audit log
  -> return 201 immediately
  -> queueMicrotask: POST Backend 2 /internal/v1/flood-analyses
  -> persist validated analysis result or failed/timed-out state
```

The durable report exists before the AI request completes. On successful AI analysis, Backend 1 changes `finalSeverity` to the returned suggestion, sets `aiUsed=true`, and moves the report to `PROVISIONAL`. Backend 2 has no database credentials and does not permanently store image bytes.

The main `frontend/` uses direct `POST /reports`. The `wireframe/` comparison app retains the alternate `POST /reports/analyze` then `POST /reports/:draftId/submit` draft/review path.

## API surface

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/ready`, authenticated `GET /health/services` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/PATCH /users/me`, ADMIN `GET /users`, `GET/PATCH /users/:userId` |
| Reports | `POST /reports`, alternate `POST /reports/analyze`, `GET /reports`, `GET /reports/map`, `GET /reports/:reportId`, `GET /reports/:reportId/image`, `POST /reports/:reportId/retry-ai`, `POST /reports/:reportId/submit`, `PATCH /reports/:reportId`, `PATCH /reports/:reportId/status`, `GET /users/me/reports` |
| Incidents | Public `GET /incidents`, `GET /incidents/:incidentId` |

See the repository [API reference](../docs/milestone2/05-api-contract.md) for request fields, authorization, response state, pagination, map bounds, Backend 2 contract, and Next.js helper endpoints.

## Security and storage boundary

- Bearer access tokens protect report/account endpoints; refresh sessions use an HttpOnly cookie.
- Report uploads accept exactly one JPEG, PNG, or WebP image. Backend 1 validates detected MIME, decodes with Sharp, applies EXIF orientation, re-encodes, and stores the processed bytes under an opaque key.
- Database rows store `image_path`, MIME, byte size, and SHA-256. The path and bytes are not returned in DTOs.
- `GET /reports/:reportId/image` is owner/moderator/admin protected and responds with private no-store bytes.
- Backend 1 is the only application service with database access.

## Local development and checks

Copy `backend/.env.example` to an ignored local environment file, then run:

```powershell
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run lint
npm run typecheck
npm test
npm run build
```

For the full stack, use the root [README](../README.md) and root `docker-compose.yml`. Do not commit secrets, uploads, generated Prisma output, or local environment files.
