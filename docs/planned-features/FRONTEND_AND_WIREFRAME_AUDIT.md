# FloodReady frontend and wireframe audit

Audit date: 2026-07-16. Repository inspection preceded implementation.

| Topic | Finding | Evidence |
|---|---|---|
| Frontend framework | Next.js 16, React 19, TypeScript | `frontend/package.json`, `wireframe/package.json` |
| Routing | App Router route groups `(public)` and `(protected)` | `frontend/src/app`, `wireframe/src/app` |
| Production frontend | Dark FloodReady UI, protected shell, public landing/auth routes | `frontend/src/app`, `frontend/src/components/app-shell/protected-shell.tsx` |
| Wireframe structure | A separate Next app with a light Milestone 2 UI | `wireframe/src/app`, `wireframe/src/components/app-shell/protected-shell.tsx` |
| Map library/provider | MapLibre GL; dark CARTO fallback or environment style URL | `*/src/features/map/map-canvas.tsx`, `*/src/lib/env/client.ts` |
| API client | Typed Zod response contracts and one request wrapper | `frontend/src/lib/api/contracts.ts`, `frontend/src/lib/api/request.ts` |
| Authentication | Bearer access token plus refresh-cookie restoration | `frontend/src/features/auth/*`, `backend/src/modules/auth/*` |
| Report APIs | Report create/draft analysis, map list, own list, detail, image, retry analysis | `backend/src/modules/reports/reports.routes.ts`, `frontend/src/features/reports/api.ts` |
| Incident API | Read-only list/detail, bbox/category/severity/status filters | `backend/src/modules/incidents/*`, `frontend/src/features/incidents/api.ts` |
| Existing production pages | Dashboard, map, reports, submit report, alerts, profile, settings and supporting pages | `frontend/src/app/(protected)` |
| Existing wireframe pages | Milestone 2 reports map, submission, submitted reports, settings, plus redirects | `wireframe/src/app/(protected)` |
| Enums | Report categories, severity, verification, incident lifecycle, AI status | `backend/src/modules/reports/reports.types.ts`, `backend/src/modules/incidents/incidents.types.ts`, `frontend/src/lib/api/contracts.ts` |
| Database/PostGIS | PostgreSQL/PostGIS, report/incident geography point columns and spatial indexes | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260711000000_init/migration.sql` |
| AI/weather | AI service fetches Open-Meteo internally then calls Gemini from server-side code | `ai-service/app/services/weather.py`, `ai-service/app/services/providers.py` |
| Notifications | No backend alerts or notification-delivery module/route exists | `backend/src/routes/index.ts`, `backend/src/modules` |
| Clustering | No server cluster route, cluster media, radius, merge/split, or prediction implementation exists | `backend/src/modules/incidents/*`, `backend/prisma/schema.prisma` |
| Area/geocoding | No area-search, geocoding, area-statistics, or area-summary route exists | `backend/src/routes/index.ts` |
| Responsive/accessibility | Tailwind responsive utilities, keyboard buttons/labels, reduced-motion CSS | `*/src/app/globals.css`, `frontend/src/components/*` |
| Tests | Vitest, Testing Library, MSW, Playwright and source-policy checks | `*/package.json`, `*/src/tests`, `*/src/features/**/__tests__` |

## Capability matrix

| Feature | Frontend existed before task | Backend API exists | Production-ready after task | Wireframe required |
|---|---:|---:|---:|---:|
| Report clustering | No | No | Not rendered in production; wireframe-only simulation | Yes |
| Cluster gallery | Report image only | Per-report image only | No | Yes |
| Weather context | Report analysis display | Internal AI weather enrichment | Partial - report-level only | Yes |
| Nearby alerts | Demo/live-derived page | No | Active incidents with browser-local dismiss/restore | Yes |
| Area Intelligence | No | No | Live active-incident summary, coordinate context, refresh and map links; server geocoding/AI summary deferred | Yes |
| AI area summary | No | No | No controlled state | Yes |
| Marker lifecycle | Incident status exists | Yes, incident status only | Partial | Yes |
| Saved areas | No | No | Browser-local persistence, clearly labelled | Yes |

Initial validation before edits: frontend tests `14/14` files and `28/28` tests passed; wireframe tests `22/22` files and `60/60` tests passed; both lint, typecheck and production builds passed. The backend isolated test runner could not reach Docker from this execution environment (`dockerDesktopLinuxEngine` named pipe unavailable).
