# Presentation script

## Wireframe demonstration

1. Open `/wireframe/planned-features/map`; point out the prominent wireframe notice.
2. Select **Cluster expanding**, then open the 21-report marker. Explain that distance, time and compatible category form the simulated visual group; open manholes remain separate.
3. Browse gallery thumbnails/arrows, show current/predicted severity separately, expand escalation factors and use road-clear confirmation.
4. Select **Road blocked** to show the closable nearby alert. Use View on map.
5. Open Area Intelligence, search `Sector 18, Gurugram`, then select **AI summary unavailable** and **Search failure**.
6. Open Alerts and Saved Areas; state that every number, photo, prediction and alert in this mode is simulated.

## Production frontend demonstration

1. Sign in and open `/map`. Show the `GET /reports/map` request in DevTools and select a real report.
2. Toggle Density, then use the severity legend and report details panel to explain the real marker state.
3. Open My Reports and a real protected evidence image. Explain that Gemini is called only by the AI service, not the browser.
4. Open `/area-intelligence`, `/alerts`, and `/saved-areas`. Show the live Incident API feed, local alert dismissal, and a saved map location that persists after refresh.
5. Explain the remaining endpoint requirements from `FUTURE_BACKEND_REQUIREMENTS.md`.

Answers: clustering remains simulated in the wireframe only; AI is never called from the frontend; report weather is server-side AI enrichment; production alert dismissal and saved areas are browser-local until account APIs are added; API failure states show no fake data.
