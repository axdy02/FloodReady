# Production frontend planned-feature status

Production routes:

- `/area-intelligence` — live active-incident feed with calculated counts, severity totals, coordinate context, refresh, and map links.
- `/saved-areas` — browser-persisted locations with validation, removal, and map links. It intentionally does not claim account persistence.
- `/alerts` — live active-incident alerts with refresh, local dismiss/restore, and map links.

`/map` continues to use the real `GET /reports/map` API. It offers the density toggle, severity legend, direct marker selection, and report details. The removed viewport grouping/list overlays are not rendered or added as MapLibre layers.

`frontend/src/features/planned-features/feature-flags.ts` records disabled server-dependent capabilities. `FeatureUnavailableState` prevents empty/broken pages and names the endpoint still needed. Existing report submission, background AI analysis, protected image loading, My Reports and authentication remain untouched. Weather remains server-side; the submit UI does not call a weather provider from the browser.

Accessibility: real buttons, visible focus styles supplied by existing app styles, labels for saved-area fields, live status/error regions, and reduced-motion CSS are retained. The wireframe and production pages use responsive Tailwind grids.
