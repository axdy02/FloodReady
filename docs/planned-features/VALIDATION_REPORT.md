# Planned-features validation report

Validated on 16 July 2026 against the final workspace source.

| Check | Result | Evidence |
|---|---|---|
| Backend acceptance | PASS | `backend: npm run acceptance` completed lint, source policy, typecheck, Prisma validation, build, 15 Vitest files / 54 tests, isolated Docker migration, and backend runtime verification. |
| Production frontend static checks | PASS | `frontend: npm run lint`, `npm run quality:source`, and `npm run typecheck`. |
| Production frontend verification | PASS | `frontend: npm run verify` completed lint, source policy, typecheck, coverage, and production build: 17 files / 39 tests. |
| Production frontend coverage | PASS | 91.35% statements, 81.25% branches, 85.94% functions, 96.64% lines; thresholds are 85%/80%/85%/85%. |
| Wireframe static checks | PASS | `wireframe: npm run lint`, `npm run quality:source`, and `npm run typecheck`. |
| Wireframe verification | PASS | `wireframe: npm run verify` completed lint, source policy, typecheck, coverage, and production build: 24 files / 73 tests. |
| Wireframe coverage | PASS | 90.38% statements, 80.16% branches, 90.55% functions, 93.07% lines; thresholds are 85%/80%/85%/85%. |
| Wireframe build | PASS | `wireframe: npm run build:test`; all four `/wireframe/planned-features/*` routes build. |
| AI service tests | PASS | `ai-service: .venv\\Scripts\\python.exe -m pytest` -- 18 tests. |
| AI service static checks | PASS | `ai-service: ruff check .` and `mypy app` -- 21 source files, no issues. |
| Complete Docker stack | PASS | `docker compose --env-file .env up --build --detach --wait --wait-timeout 180` completed successfully. |
| Runtime health | PASS | HTTP 200: frontend `:3000/api/health`, Backend 1 `:3001/api/v1/health/ready`, wireframe `:3002/api/health`, Backend 2 `:8000/health` and `:8000/health/ready`. |
| New pages served by runtime | PASS | HTTP 200: production `/area-intelligence`; wireframe `/wireframe/planned-features/map`. |
| Production mock isolation | PASS | Targeted source scans found no wireframe/mock/demo imports in production planned-features, Area Intelligence, Saved Areas, or Alerts. |
| Direct Gemini/provider call from production browser code | NONE | Source scan of `frontend/src` found no Gemini/provider/key references. Browser API traffic goes through `frontend/src/lib/api/request.ts`. |
| AI/weather HTTP call from planned wireframe | NONE | Source scan found no `fetch`, provider, or weather-client call in `wireframe/src/features/planned-features`. |

## Coverage gate status

Both `npm run verify` coverage gates pass without changing their thresholds. The additional tests exercise the MapLibre adapter through a deterministic test double, production report submission states, application-mode adapters, wireframe scenario controls, and error handling.

## Manual checks not represented by these commands

No browser-driven visual/console or touch-viewport session was run in this validation pass. The responsive mobile navigation has been implemented and production builds pass, but final presentation sign-off should still include a brief manual pass at desktop and phone widths.
