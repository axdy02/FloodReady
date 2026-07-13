# FloodReady Frontend

FloodReady uses Next.js with a strict client/server environment boundary. Install the pinned toolchain with `npm ci`, then use `npm run lint`, `npm run quality:source`, `npm run typecheck`, `npm test`, and `npm run build:test` for fixture-only validation.

`npm run build:test` reads only the committed non-secret `.env.test`. Product builds require the user-supplied ignored `.env.local` after the map-provider and viewport inputs have been reviewed. The frontend health route is `GET /api/health` and does not check downstream services.
