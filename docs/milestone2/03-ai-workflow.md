# AI workflow

1. Backend 1 validates fields and image, normalizes and privately saves the evidence, then creates `report_drafts` plus `ai_analyses(PROCESSING)`.
2. Backend 1 sends a token-authenticated multipart request to Backend 2 with the draft ID, analysis ID, allowed severity values, description, image bytes, and the already-validated latitude/longitude.
3. Backend 2 checks the internal token, MIME/content, byte and pixel limits; it re-encodes a bounded JPEG. It requests the selected location's prior two days/current weather from Open-Meteo, but retains a neutral image-only score if that supporting service is unavailable.
4. Gemini 3.1 Flash-Lite receives text, image, and weather context and is constrained to JSON fields: flood detection, suggested severity, image confidence, water category, road passability, quality, evidence flags, and review reminder.
5. Backend 2 combines image confidence (70%) with weather context (30%) into `validationScore` and labels it `ACCEPTED`, `NEEDS_REVIEW`, or `REJECTED`. This is a community-report likelihood, never an official verification. Backend 1 validates the response schema and persists the score, weather summary, and result; timeout/unavailable/invalid responses become `TIMED_OUT` or `FAILED` with a controlled code.
6. The user explicitly accepts a suggestion, keeps their choice, or selects another valid final severity. Only then does Backend 1 move the draft into `flood_reports`.

The browser shows transparent stages while this runs: photo evidence, rainfall/current-weather lookup, score calculation, then completion. An absent Gemini key produces a controlled unavailable result and manual continuation. No mock AI answer is shown as real.
