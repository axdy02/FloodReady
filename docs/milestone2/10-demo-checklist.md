# How to use and demo FloodReady

## One-time setup

1. Copy `.env.example` to `.env`.
2. Fill database/JWT secrets and `AI_SERVICE_TOKEN` with strong base64url values.
3. Set `AI_PROVIDER_API_KEY` to your Gemini key. Keep `AI_MODEL=gemini-3.1-flash-lite`.
4. Run `node scripts/verify-compose.mjs --env-file .env`, then the Docker startup commands in the root README.
5. Open `http://localhost:3000/register` and create a citizen account.

## Walkthrough

1. Click **Submit Flood Report**.
2. Select a category, severity, and a specific description (at least 10 characters).
3. Add one JPEG, PNG, or WebP photo. The preview is local; it is not public.
4. Click the map for a pin or use device location.
5. Choose **Analyze with AI**. Explain that Backend 1 creates a draft and calls Backend 2; Backend 2 calls Gemini using a server-only key.
6. Read the AI card. Say it is advisory. Choose **Accept AI suggestion**, **Keep my severity**, or choose manually; this is the human override.
7. Click **Submit final report**.
8. Open **My Reports** and show the saved record and its protected evidence photo.
9. Open **Reports Map**, find/open the marker, and reload the page. The marker remains because it came from PostgreSQL/PostGIS.

## If Gemini is unavailable

Leave the key blank or disconnect the analysis service. The analysis card will show a controlled failure. Select **Continue without AI**, choose final severity, submit, and repeat steps 8–9. This demonstrates safe degradation rather than fake intelligence.
