# How to use and demo FloodReady

## Setup

1. Copy `.env.example` to `.env`, provide database/JWT secrets and `AI_SERVICE_TOKEN`, and optionally configure `AI_PROVIDER_API_KEY`.
2. Run `node scripts/verify-compose.mjs --env-file .env`, then the Docker startup commands in the root README.
3. Open `http://localhost:3000/register` for the canonical `frontend/` app. The comparison `wireframe/` app is on `http://localhost:3002`.

## Main walkthrough

1. Sign in and open **Submit Flood Report**.
2. Choose a category and claimed severity, enter the description, select a map location, and attach one JPEG, PNG, or WebP image.
3. Submit once. Explain that Backend 1 validates/stores the image, creates the final report and `ai_analyses(PROCESSING)`, and returns immediately.
4. Open **My Reports** or **View on map**. The pending report is already persisted and appears with a neutral AI-in-progress marker.
5. Refresh after background processing. Show the stored AI assessment, suggested/final severity, and validation status.
6. Open the report evidence image to show that it is served through the protected Backend 1 route, not a public storage URL.
7. Reload the map and explain that markers come from `GET /api/v1/reports/map`, not frontend state.

## If AI is unavailable

The report still saves. The analysis records a controlled failure or timeout, the report remains visible with the claimed severity, and the owner can retry AI validation. Do not claim that the main frontend offers a pre-submit human severity override; that behavior belongs only to the alternate `wireframe/` draft flow.
