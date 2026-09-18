# FloodReady main frontend

`frontend/` is the canonical Next.js application served at `http://localhost:3000` by the root Compose stack. It is the primary Milestone 2 user interface.

Its report form sends authenticated multipart `POST /api/v1/reports` requests to Backend 1. Backend 1 persists the report immediately; the frontend shows the pending report and polls the owner report list while `aiAnalysis.status` is `PROCESSING`. It never calls Backend 2, Gemini, PostgreSQL, private image storage, or the report-AI weather lookup directly.

Browser-facing Backend 1 calls are implemented in `src/lib/api/` and `src/features/reports/api.ts`. The main report endpoints are:

- `POST /reports`
- `GET /users/me/reports`
- `GET /reports/:reportId`
- `GET /reports/:reportId/image`
- `POST /reports/:reportId/retry-ai`
- `GET /reports/map`

The app also has Next.js server route handlers for `/api/health`, `/api/status`, `/api/geocode`, and `/api/weather`. The latter two proxy public Nominatim/Open-Meteo data for UI features; they are distinct from Backend 2's internal AI workflow.

Use `npm ci`, then `npm run lint`, `npm run quality:source`, `npm run typecheck`, `npm test`, and `npm run build`. Product builds require an ignored `.env.local`; fixture builds use committed `.env.test`.

For complete API contracts, see [docs/milestone2/05-api-contract.md](../docs/milestone2/05-api-contract.md).
