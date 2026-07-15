# Milestone 2 documentation index

Use these files for the current presentation and evaluator review:

- [01-architecture.md](01-architecture.md) - current service boundaries, direct persistence, background AI call, image lifecycle, and map read.
- [02-schema.md](02-schema.md) - current Prisma entities and the primary report/analysis state transition.
- [03-ai-workflow.md](03-ai-workflow.md) - concise AI workflow summary.
- [04-image-lifecycle.md](04-image-lifecycle.md) - concise image-storage summary.
- [AI_SYSTEM_README.md](AI_SYSTEM_README.md) - full AI contract, validation, privacy, failure, retry, and known limitations.
- [architecture-presentation.svg](architecture-presentation.svg) - slide-ready architecture diagram.
- [schema-presentation.svg](schema-presentation.svg) - slide-ready schema diagram.
- [architecture-presentation.mmd](architecture-presentation.mmd) and [schema-presentation.mmd](schema-presentation.mmd) - editable Mermaid sources.
- [schema.dbml](schema.dbml) - presentation DBML derived from Prisma and migrations.
- [architecture-evidence.md](architecture-evidence.md) - source ledger for diagram boxes and arrows.

## Current frontend status

- `frontend/` is the canonical Next.js app and runs on port 3000. It submits reports immediately, polls background AI state, and renders the persisted map marker.
- `wireframe/` is retained as an alternate comparison/testing app and runs on port 3002. It exercises the older draft/review endpoints.
- `docker-compose.yml` defines both services. Both use the same Backend 1 API, PostgreSQL data, private image storage, and AI-result fields.

The files marked as archived are historical records from earlier repository states and should not be used as the current architecture claim.
