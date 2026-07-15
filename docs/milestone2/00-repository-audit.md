# Repository audit

The repository contains two Next.js frontends (`frontend/` is the canonical port-3000 app and `wireframe/` is a port-3002 comparison app), one Node/Express application API (Backend 1), one FastAPI analysis service (Backend 2), PostgreSQL/PostGIS migrations, and private filesystem evidence storage. The canonical database authority is `backend/prisma/schema.prisma` and its committed migrations; no frontend mock data is used for submitted reports or map markers.

The scoped Milestone 2 user journeys are direct report submission, background AI enrichment, persisted My Reports evidence, and report display on the map. The alternate wireframe draft/review flow and legacy dashboard pages remain outside the primary presentation path.
