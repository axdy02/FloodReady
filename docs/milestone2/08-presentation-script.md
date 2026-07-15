# Presentation script

“FloodReady Milestone 2 has a reporting workflow and a persisted reports map. A signed-in user chooses a location, enters the incident details, and uploads one evidence image in the main `frontend/` app.

The browser sends one authenticated multipart request to Backend 1. Backend 1 validates and re-encodes the image, stores the processed bytes in the private uploads volume, and creates the final `flood_reports` row plus an `ai_analyses` row in `PROCESSING`. It returns the saved report immediately, so the report can already appear on the map.

Backend 1 then uses an in-process background task to send the processed image and report context to Backend 2. Backend 2 preprocesses the image, gets supporting weather context from Open-Meteo, and calls Gemini for structured triage. Backend 1 validates and stores the result. A success updates the persisted AI severity and marks the report provisional; a failure remains visible and can be retried by the owner.

My Reports and Reports Map read the persisted rows from Backend 1. MapLibre renders the report coordinates as a marker, and the image remains private behind an authenticated image endpoint. The separate `wireframe/` app demonstrates an older draft/review contract, but it is not the primary flow.”
