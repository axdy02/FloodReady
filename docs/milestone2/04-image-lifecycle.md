# Image lifecycle

The browser previews the selected local file only. The main frontend sends that file to Backend 1, which validates its signature, dimensions, and MIME type, applies EXIF-safe processing, and stores the processed bytes under a UUID-based private local-storage key. PostgreSQL stores only the opaque `image_path` and processed-byte metadata.

The report and its `ai_analyses(PROCESSING)` row are committed before the background AI call. Backend 1 sends the processed bytes to Backend 2 over the internal multipart request; Backend 2 validates and preprocesses them in memory, calls Gemini, and does not persist a copy. The frontend never receives the storage path. Authorized image reads go back through Backend 1, which returns private/no-store bytes.

There is no object-storage provider, signed URL, `Media` table, media ID, or scheduled cleanup worker in the current repository. The alternate `wireframe/` draft flow uses the same private storage implementation but is not the primary report-to-map path.
