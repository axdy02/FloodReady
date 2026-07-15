# Viva questions

1. **Why two backends?** Backend 1 owns authentication, storage, the database, and map data. Backend 2 isolates image preprocessing, weather context, and the AI provider and has no database access.
2. **When is the report saved?** Backend 1 saves `flood_reports` and `ai_analyses(PROCESSING)` in one transaction before the background AI call completes.
3. **What does Backend 1 send to Backend 2?** A bearer-authenticated multipart request containing the processed image, report/analysis IDs, description, claimed severity, coordinates, MIME, and allowed severities.
4. **What does Backend 2 send to Gemini?** The prepared image plus the description, claimed severity, weather summary, and allowed severity values; it requests structured JSON.
5. **What if AI fails?** The report remains persisted with its claimed severity; the analysis records `FAILED` or `TIMED_OUT`, and the owner can trigger `retry-ai`.
6. **Who owns the image?** Backend 1 stores processed bytes under an opaque local key. Backend 2 receives bytes only for the current request and does not persist them.
7. **How is the photo private?** Only an authorized owner or privileged reviewer can fetch it through Backend 1; the map DTO does not expose the path or bytes.
8. **Why store image hashes?** The SHA-256 documents the processed bytes for integrity/audit support; duplicate rejection is not implemented.
9. **Why PostGIS?** It stores the generated geographic point and supports bounded map queries.
10. **Does AI officially verify flooding?** No. The provider result is advisory triage and `PROVISIONAL` is not official agency verification.
