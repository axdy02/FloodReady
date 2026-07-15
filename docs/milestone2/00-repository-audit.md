# Repository audit

The repository contains one Next.js frontend, one Node/Express application API (Backend 1), one FastAPI analysis service (Backend 2), PostgreSQL/PostGIS migrations, and private filesystem evidence storage. The canonical database authority is `backend/prisma/schema.prisma` and its committed migrations; no frontend mock data is used for submitted reports or map markers.

The scoped Milestone 2 user journeys are report submission and persisted report display on the map. Legacy dashboard pages remain outside the presentation path.
