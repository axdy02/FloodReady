# Testing evidence

Run frontend unit/type/build checks with `cd frontend; npm run verify`. Run Backend 1 lint/type checks with `cd backend; npm run lint; npm run typecheck`. Run the isolated stack/E2E checks where Docker is available. The test suite covers form validation, protected images, the direct create contract, background-analysis state, API contracts, map queries, authentication, and report-to-map persistence. The alternate `wireframe/` app has separate draft/manual-review coverage.

Live Gemini verification additionally requires a valid local `AI_PROVIDER_API_KEY`; it is intentionally never stored in the repository.

The container installs the exact versions in `ai-service/requirements.in`. Regenerate `requirements-prod.lock` with `pip-compile --generate-hashes` in a network-enabled CI environment before a production release; this desktop workspace cannot download Python packages.
