# Functional wireframes

The canonical `frontend/` application exposes the authenticated reporting workflow, My Reports, and Reports Map. The main submission screen collects category, claimed severity, description, location, and one JPEG/PNG/WebP evidence image, then submits directly to Backend 1.

After submission the UI confirms that the report is saved, shows a link to the map, and explains that AI validation is running in the background. My Reports polls while analysis is processing and can expose owner-triggered retry after a failed attempt. The map reads persisted markers from Backend 1 and displays a neutral pending marker or the completed AI assessment.

`wireframe/` is retained as a separate comparison/testing frontend on port 3002. Its form demonstrates the older draft -> AI review -> submit flow with a human severity choice; do not present that interaction as the main `frontend/` behavior.
