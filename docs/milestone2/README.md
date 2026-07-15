# Milestone 2 documentation index

Use these files for the current presentation and evaluator review:

- [01-architecture.md](01-architecture.md) — service boundaries, image lifecycle, AI call, persistence, and map read.
- [02-schema.md](02-schema.md) — current Prisma entities, draft-to-report transition, and map projection.
- [03-ai-workflow.md](03-ai-workflow.md) — concise AI workflow summary.
- [04-image-lifecycle.md](04-image-lifecycle.md) — concise image-storage summary.
- [AI_SYSTEM_README.md](AI_SYSTEM_README.md) — complete AI contract, validation, privacy, failure, timeout, concurrency, and known limitations.
- [architecture-presentation.svg](architecture-presentation.svg) — slide-ready architecture diagram.
- [schema-presentation.svg](schema-presentation.svg) — slide-ready schema diagram.
- [architecture-presentation.mmd](architecture-presentation.mmd) and [schema-presentation.mmd](schema-presentation.mmd) — editable Mermaid sources.
- [schema.dbml](schema.dbml) — current presentation DBML derived from Prisma and migrations.
- [architecture-evidence.md](architecture-evidence.md) — source ledger for every diagram box and arrow.

The files marked “Archived pre-AI” or “Archived presentation” are historical records and must not be used as the current architecture or test claim. They intentionally describe the earlier health-only FastAPI state.

## Repository discrepancy

The current working tree contains the Next.js frontend under `wireframe/`, while `docker-compose.yml` and several historical documents reference `frontend/`. The canonical architecture documents expose this mismatch instead of treating the missing path as implemented. Resolve that path mismatch before a clean Compose deployment is claimed.
