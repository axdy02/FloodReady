# Planned features wireframe

Routes are public on the separate wireframe app so they can be presented without signing in:

- `/wireframe/planned-features/map`
- `/wireframe/planned-features/area-intelligence`
- `/wireframe/planned-features/alerts`
- `/wireframe/planned-features/saved-areas`

## Start the presentation wireframe

From the repository root, start the full stack with `docker compose --env-file .env up --build --detach --wait`, then open `http://localhost:3002/wireframe/planned-features/map`. The planned-feature routes remain local scenarios even while the rest of the stack is running.

All data is local and explicitly marked **WIREFRAME MOCK DATA — NOT PRODUCTION DATA** in `wireframe/src/wireframe/mock-data/planned-features.ts`. The wireframe imports no production API client, Gemini client, weather client or production mock fallback for these routes.

The map page demonstrates dense/expanding/large clusters, central count markers, approximate circles, simulated density, an image-style gallery, lifecycle, escalation explanation, category-aware weather copy, road-clear confirmation and a dismissible nearby alert. The Area Intelligence page demonstrates mock area search, statistics, mini-map, report list, gallery/timeline concepts and AI-unavailable state. Alerts and saved areas are interactive local demonstrations.

Use **Wireframe demo controls** to select Normal, Heavy rainfall, Cluster expanding, Road blocked, Incident becoming stale, Incident resolved, Open manhole, AI summary unavailable, Weather unavailable, No reports, Search failure, or Reset demo.

Presentation order: map scenario controls → select a cluster → gallery and confirmation → area search → AI unavailable scenario → alerts → saved areas.
