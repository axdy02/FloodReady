# FloodReady

FloodReady currently implements two connected features: authenticated users submit a flood report with a private evidence image, and the same persisted report appears on the shared map while Backend 1 validates it with Backend 2.

## Architecture

```text
Main frontend (3000) ─┐
Wireframe (3002) ────┼──> Backend 1 / Express + Prisma (3001) ──> PostgreSQL + PostGIS
                     │                         │
                     └─────────────────────────┴──> Backend 2 / FastAPI + LangGraph + Gemini + Open-Meteo (8000)
```

- `frontend/` is the main, user-facing Next.js application at `http://localhost:3000`.
- `wireframe/` is preserved for comparison/testing at `http://localhost:3002`.
- Both frontends use the same authenticated Backend 1 API, PostgreSQL data, protected report images, and AI-result fields.
- Backend 1 owns persistence and API responses. Backend 2 has no database access; it receives a controlled internal request containing the report image and selected location.
- A LangGraph validation workflow coordinates weather evidence, Gemini 3.1 Flash-Lite image analysis, response validation, and final scoring. Open-Meteo supplies the previous two days and current weather for location context.

## Report validation flow

1. A user submits category, description, claimed severity, coordinates, captured time, and one evidence image to `POST /api/v1/reports`.
2. Backend 1 validates and stores the image and report in PostgreSQL immediately, creates an `AiAnalysis` with `PROCESSING`, and returns `201 Created` with `verificationStatus: PENDING_REVIEW`.
3. The report is immediately available through `GET /api/v1/reports/map` and `GET /api/v1/users/me/reports`. Both frontends render it as a grey `?` marker / **Validating** state.
4. Backend 1 calls Backend 2 in the background. On success, it stores the AI severity, confidence, weather summary, validation score, and metadata separately from `severityClaim`, then moves the report to `PROVISIONAL`.
5. The frontends poll only while a report is processing. When the AI result is stored, the marker changes colour and both the map and report history show the claimed severity alongside the AI assessment.
6. If the AI call fails or times out, the report and original severity remain stored. The UI keeps it visible as a neutral/manual-review state; it is never discarded.

The database authority is [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) plus the committed migrations. Existing public response DTOs expose both the original user input (`severityClaim`) and AI output (`aiAnalysis.suggestedSeverity`, `confidenceScore`, and validation fields).

The current route-by-route contract is in [docs/milestone2/05-api-contract.md](docs/milestone2/05-api-contract.md). It documents Backend 1 account/report/incident APIs, Backend 2's protected internal analysis endpoint, and the Next.js helper routes.

## Run the complete stack

Copy `.env.example` to the ignored `.env`, fill the required secrets, and set a Gemini key if live validation is needed:

```dotenv
AI_PROVIDER=gemini
AI_PROVIDER_API_KEY=your_gemini_api_key
AI_MODEL=gemini-3.1-flash-lite
AI_MODEL_VERSION=gemini-3.1-flash-lite
```

Then start every service:

```powershell
docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up --detach --wait --wait-timeout 180
docker compose --env-file .env ps
```

Open:

- Main frontend: `http://localhost:3000`
- Wireframe: `http://localhost:3002`
- Backend health: `http://localhost:3001/api/v1/health/ready`
- AI service: `http://localhost:8000/health/ready`

To rebuild only a UI, use `docker compose --env-file .env build frontend` or `docker compose --env-file .env build wireframe`, then recreate that service with `docker compose --env-file .env up --detach --force-recreate frontend` (or `wireframe`).

## Manual verification

1. Register at either frontend and sign in.
2. Use **Submit a Report** to add a description, a JPEG/PNG/WebP image, and a map point or device location.
3. After submission, open **Map**. The report is already present as a grey marker with a visible `?` and the text **AI validation in progress**.
4. Open **Reports**. The report shows its evidence thumbnail, original severity, `Validating…`, and its timestamp.
5. Wait for the automatic update. The marker changes to the result severity colour, and **Reports** displays both the submitted severity and AI assessment/confidence.
6. If validation cannot complete, confirm the report remains on the map and in **Reports** with **Manual review required**.

The production workspace navigation includes **Dashboard**, **Map**, **Reports**, **Submit a Report**, **Area Intelligence**, **Alerts**, and **Saved Areas**. Area Intelligence and Alerts read the live Incident API; Saved Areas and alert dismissal persist locally in the browser. See [`docs/planned-features/PRODUCTION_API_MATRIX.md`](docs/planned-features/PRODUCTION_API_MATRIX.md) for the exact data boundaries.

## Quality checks

```powershell
# Backend
cd backend
npm run lint
npm run typecheck
npm test
npm run build

# Main frontend
cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build

# Wireframe
cd ../wireframe
npm run lint
npm run typecheck
npm test
npm run build

# AI service
cd ../ai-service
pytest
```

The current background validation worker runs within Backend 1. Reports are persisted before it starts, so an AI outage cannot lose citizen evidence. A durable external job queue is the next production-scale improvement.
