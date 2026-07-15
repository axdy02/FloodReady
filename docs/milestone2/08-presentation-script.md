# Presentation script

“FloodReady Milestone 2 has only two features. First, a citizen submits a flood report with a photo and location. Second, after the report is persisted, it appears on the map.

The browser sends the form to Backend 1. Backend 1 is the owner of authentication, image validation, storage, database writes, and all map data. It stores a temporary draft before asking Backend 2 for advisory image analysis. Backend 2 has no database access; it validates the image and calls Gemini 3.1 Flash-Lite for strict structured JSON. The user still selects the final severity, so AI never verifies or overrides a citizen report.

When I submit, the draft becomes a persisted `flood_reports` row, the analysis is linked to it, and the photo remains private. My Reports retrieves the row and protected photo through authorization. Reports Map retrieves the same persisted record by coordinates. I can reload the page to prove it is data, not frontend state.”
