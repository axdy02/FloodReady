# FloodReady comparison wireframe

`wireframe/` is the separate Next.js comparison/testing application exposed at `http://localhost:3002` by the root Compose stack. It uses the same Backend 1 API, PostgreSQL data, protected image endpoint, and map data as the main frontend.

Unlike the canonical `frontend/` direct-submit flow, this app retains the older draft/review sequence:

```text
POST /api/v1/reports/analyze
-> report_drafts + AI analysis
-> user review / finalSeverity
-> POST /api/v1/reports/:draftId/submit
```

Use it to demonstrate or compare the legacy review UI only. Do not use it to describe the port-3000 main frontend workflow, which persists `flood_reports` before the background AI call completes.

For the authoritative current API contract, see [docs/milestone2/05-api-contract.md](../docs/milestone2/05-api-contract.md).
