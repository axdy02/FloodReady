# FloodReady Milestone 1

FloodReady is a local, fictional flood-reporting stack with a Next.js frontend, Express/PostGIS backend, and health-only FastAPI service. The canonical Docker Compose file runs all services with internal DNS, loopback-only application ports, non-root processes, read-only roots, dropped capabilities, and persistent database/upload volumes.

## Setup

Copy `.env.example` to `.env`, supply the required secrets, and keep the approved map values byte-identical to `frontend/.env.local`. Then validate and start the stack:

```text
node scripts/check-source.mjs
node scripts/verify-compose.mjs --env-file .env
docker compose --env-file .env config --quiet
docker compose --env-file .env up --detach --wait --wait-timeout 180 db
docker compose --env-file .env run --rm --no-deps migrate
docker compose --env-file .env up --detach --no-deps --wait --wait-timeout 180 backend ai-service frontend
```

The optional demo profile requires `DEMO_SEED_ENABLED=true` and three supplied, pairwise-distinct fictional demo passwords. It never creates production data or real flood claims.

## Verification

The root acceptance runner uses only ignored ephemeral credentials and cleans its scoped files and Compose resources:

```text
node scripts/acceptance.mjs --compose-only
```
