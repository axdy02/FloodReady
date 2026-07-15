# Viva questions

1. **Why two backends?** Backend 1 owns the system of record; Backend 2 isolates model/image processing from the database.
2. **Why draft first?** A human must review AI advice before a report becomes public map data.
3. **What if AI fails?** The analysis is recorded as failed/timed out and the reporter can continue manually.
4. **Who decides severity?** The user’s `final_severity`; AI gives only a suggestion.
5. **How is the photo private?** Only an authenticated owner or privileged reviewer can fetch evidence bytes.
6. **Why store image hashes?** Integrity/audit support without exposing content.
7. **Why PostGIS?** It performs efficient geographic bounding-box marker queries.
8. **Why not call Gemini from the frontend?** It would expose the API key and bypass server controls.
9. **How do you prevent fake map data?** Markers come from persisted `flood_reports`, never frontend arrays.
10. **How do you prevent unsupported image uploads?** MIME claim, file signature, decode, dimensions, and byte limits are checked.
