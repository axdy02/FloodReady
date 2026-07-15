# Milestone 2 database schema

The authoritative schema is `backend/prisma/schema.prisma` plus every migration under `backend/prisma/migrations/`. The application uses one PostgreSQL 18/PostGIS 3.6 database and the PostgreSQL `public` schema. Backend 1 is the only service with application database access.

## Presentation diagram

![Milestone 2 database schema](schema-presentation.svg)

The editable Mermaid source is [schema-presentation.mmd](schema-presentation.mmd). The DBML source is [schema.dbml](schema.dbml).

```mermaid
erDiagram
  USERS ||--o{ REFRESH_SESSIONS : owns
  REFRESH_SESSIONS o|--|| REFRESH_SESSIONS : replaces
  USERS ||--o{ REPORT_DRAFTS : creates
  REPORT_DRAFTS ||--o| AI_ANALYSES : has_during_review
  USERS ||--o{ FLOOD_REPORTS : submits
  FLOOD_REPORTS ||--o| AI_ANALYSES : owns_after_submit
  INCIDENTS o|--o{ FLOOD_REPORTS : groups
  USERS ||--o{ AUDIT_LOGS : acts

  USERS {
    uuid id PK
    varchar name
    varchar email UK
    enum role
  }
  REPORT_DRAFTS {
    uuid id PK
    uuid reporter_id FK
    enum severity_claim
    varchar image_path
    varchar image_mime
    int image_size
    char image_sha256
    timestamptz expires_at
  }
  AI_ANALYSES {
    uuid id PK
    uuid draft_id FK_UK
    uuid report_id FK_UK
    enum status
    enum suggested_severity
    decimal confidence_score
    decimal validation_score
    varchar validation_outcome
  }
  FLOOD_REPORTS {
    uuid id PK
    uuid reporter_id FK
    enum severity_claim
    enum final_severity
    boolean ai_used
    varchar image_path
    geography location
    enum verification_status
  }
  INCIDENTS {
    uuid id PK
    enum severity
    geography location
  }
  AUDIT_LOGS {
    uuid id PK
    uuid actor_id FK
    varchar entity_type
    uuid entity_id
  }
  REFRESH_SESSIONS {
    uuid id PK
    uuid user_id FK
    char token_hash UK
    uuid replaced_by_id FK_UK
  }
```

## Entities used by the report-to-map flow

| Table | Role in Milestone 2 | Important fields |
|---|---|---|
| `users` | Authenticated ownership and authorization | `id`, `role`, `is_active` |
| `report_drafts` | Temporary, owner-scoped record created before human review | `id`, `reporter_id`, report metadata, `image_path`, `image_mime`, `image_size`, `image_sha256`, `expires_at` |
| `ai_analyses` | One analysis attempt, first attached to a draft then transferred to the final report | `id`, `draft_id` or `report_id` (exactly one), `status`, image findings, weather fields, model metadata, error code |
| `flood_reports` | Durable final report read by the map | `id`, `reporter_id`, description, `severity_claim`, `final_severity`, `ai_used`, coordinates, `image_path`, `verification_status`, generated `location` |
| `audit_logs` | Audit trail for report creation, update, and moderation | `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` |
| `incidents` | Existing optional grouping entity | `incident_id` on a report is nullable; the current report submission flow does not create or link incidents |
| `refresh_sessions` | Auth refresh-token rotation state | User/session relations; raw refresh tokens are not stored |

## The key state transition

```text
POST /reports/analyze
  report_drafts.id = D
  ai_analyses.id = A, draft_id = D, report_id = NULL

POST /reports/D/submit { finalSeverity }
  flood_reports.id = D
  ai_analyses.id = A, draft_id = NULL, report_id = D
  report_drafts.id = D is deleted
```

The schema constraint `ai_analyses_owner_check` enforces that an analysis belongs to exactly one draft or one final report. The final severity is stored separately from the original `severity_claim`; AI output remains advisory and does not overwrite either field automatically.

## Image metadata truth

There is no separate media table and no `media_id`. The image reference is the opaque `image_path` key, while `image_mime`, `image_size`, and `image_sha256` document the processed bytes. The bytes themselves remain in the private local storage volume. During analysis, the identifier chain is:

```text
X-Request-Id
  -> report_drafts.id (also sent as Backend 2 reportId)
  -> ai_analyses.id
  -> report_drafts.image_path
  -> uploads_data/reports/YYYY/MM/<uuid>.<ext>
```

After submit, the same UUID becomes `flood_reports.id`, and the same `image_path` is retained. This is how the implementation isolates one selected image without pretending that a non-existent `Media` entity exists.

## Map projection

`GET /api/v1/reports/map` reads the generated PostGIS geography point from `flood_reports.location` and returns a privacy-safe `ReportMapDto`. It includes the persisted report ID, category, claimed/final severity, AI summary fields, coordinates, timestamps, verification status, incident ID, and `canViewDetails`. It does not return `description`, `reporter_id`, `image_path`, image bytes, email, or authentication data in the map projection. MapLibre converts the response to GeoJSON `[longitude, latitude]` points.

## Schema caveats

- `report_drafts.expires_at` is recorded, but no scheduled cleanup worker was found in the repository.
- `ai_analyses.evidence_flags` is JSONB with array-type enforcement; values are validated in Backend 2 and again in Backend 1's response schema.
- `validation_score`, `validation_outcome`, and weather columns are added by `20260715000000_weather_validated_ai_scores`.
- `incidents` and its relation are real schema objects, but incident creation is outside this Milestone 2 report submission path.
