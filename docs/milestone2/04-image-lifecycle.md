# Image lifecycle

The browser previews the selected local file only. The main frontend sends that file to Backend 1, which validates its signature, dimensions, and MIME type, applies EXIF-safe processing, and stores the processed bytes under `reports/<report-id>/<uuid>.<extension>`. PostgreSQL stores only the opaque `image_path` and processed-byte metadata. `IMAGE_STORAGE_DRIVER=local` uses the private `UPLOAD_DIRECTORY`; `IMAGE_STORAGE_DRIVER=s3` uses a private S3 bucket through the EC2 role/default AWS credential chain.

The report and its `ai_analyses(PROCESSING)` row are committed before the background AI call. Backend 1 reads the saved object through the same `ImageStorage` interface and sends those exact stored bytes to Backend 2 over the internal multipart request. Backend 2 validates and preprocesses them in memory, calls Gemini, and does not persist a copy. The frontend never receives the storage path. Authorized image reads go back through Backend 1, which streams private/no-store bytes.

There is no signed URL, `Media` table, media ID, or scheduled cleanup worker. The S3 driver keeps objects private and does not generate browser-facing S3 URLs. The alternate `wireframe/` draft flow uses the same private storage implementation but is not the primary report-to-map path.
