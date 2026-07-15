# Implemented vs future

Use [11-implemented-vs-future.md](11-implemented-vs-future.md) and [AI_SYSTEM_README.md](AI_SYSTEM_README.md) as the current capability summaries. This file is retained as a compatibility pointer because earlier presentation notes referenced it.

The current implementation includes direct report persistence, in-process background Gemini image triage, Open-Meteo weather context, persisted analysis/report state, private local evidence storage, owner-triggered analysis retry, and persisted map markers. The current implementation does not include a durable AI queue, signed URLs, object storage, scheduled cleanup, automatic AI retries/backoff, idempotency keys, duplicate rejection, malware scanning, or official verification.
