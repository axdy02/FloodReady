CREATE TYPE "AiAnalysisStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "WaterLevelCategory" AS ENUM ('NONE', 'ANKLE_LEVEL', 'KNEE_LEVEL', 'WAIST_LEVEL', 'ABOVE_WAIST', 'UNKNOWN');
CREATE TYPE "RoadPassability" AS ENUM ('PASSABLE', 'CAUTION', 'UNSAFE', 'IMPASSABLE', 'UNKNOWN');
CREATE TYPE "ImageQuality" AS ENUM ('GOOD', 'FAIR', 'POOR', 'UNUSABLE');

ALTER TABLE "flood_reports"
ADD COLUMN "final_severity" "Severity" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "ai_used" boolean NOT NULL DEFAULT false,
ADD COLUMN "image_mime" varchar(32),
ADD COLUMN "image_size" integer,
ADD COLUMN "image_sha256" char(64);

UPDATE "flood_reports"
SET "final_severity" = "severity_claim";

ALTER TABLE "flood_reports"
ADD CONSTRAINT "flood_reports_image_metadata_check"
CHECK (
  ("image_mime" IS NULL AND "image_size" IS NULL AND "image_sha256" IS NULL)
  OR (
    "image_mime" IN ('image/jpeg', 'image/png', 'image/webp')
    AND "image_size" > 0
    AND "image_sha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "report_drafts" (
  "id" uuid PRIMARY KEY,
  "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "category" "ReportCategory" NOT NULL,
  "description" varchar(1000) NOT NULL,
  "severity_claim" "Severity" NOT NULL DEFAULT 'UNKNOWN',
  "latitude" decimal(9,6) NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" decimal(9,6) NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "gps_accuracy" decimal(10,2),
  "location_source" "LocationSource" NOT NULL DEFAULT 'DEVICE_GPS',
  "captured_at" timestamptz(3) NOT NULL,
  "image_path" varchar(255) NOT NULL,
  "image_mime" varchar(32) NOT NULL CHECK ("image_mime" IN ('image/jpeg', 'image/png', 'image/webp')),
  "image_size" integer NOT NULL CHECK ("image_size" > 0),
  "image_sha256" char(64) NOT NULL CHECK ("image_sha256" ~ '^[0-9a-f]{64}$'),
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_drafts_description_length_check" CHECK (char_length(btrim("description")) BETWEEN 10 AND 1000),
  CONSTRAINT "report_drafts_location_source_accuracy_check" CHECK (
    ("location_source" = 'DEVICE_GPS' AND "gps_accuracy" IS NOT NULL AND "gps_accuracy" > 0 AND "gps_accuracy" <= 100000)
    OR ("location_source" = 'MANUAL' AND "gps_accuracy" IS NULL)
  ),
  CONSTRAINT "report_drafts_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "ai_analyses" (
  "id" uuid PRIMARY KEY,
  "draft_id" uuid UNIQUE REFERENCES "report_drafts"("id") ON DELETE CASCADE,
  "report_id" uuid UNIQUE REFERENCES "flood_reports"("id") ON DELETE CASCADE,
  "status" "AiAnalysisStatus" NOT NULL,
  "flood_detected" boolean,
  "suggested_severity" "Severity",
  "confidence_score" decimal(5,4) CHECK ("confidence_score" IS NULL OR "confidence_score" BETWEEN 0 AND 1),
  "water_level_category" "WaterLevelCategory",
  "road_passability" "RoadPassability",
  "image_quality" "ImageQuality",
  "summary" varchar(500),
  "evidence_flags" jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("evidence_flags") = 'array'),
  "needs_human_review" boolean,
  "model_name" varchar(100),
  "model_version" varchar(100),
  "processing_time_ms" integer CHECK ("processing_time_ms" IS NULL OR "processing_time_ms" >= 0),
  "error_code" varchar(64),
  "started_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_analyses_owner_check" CHECK (("draft_id" IS NULL) <> ("report_id" IS NULL)),
  CONSTRAINT "ai_analyses_completion_check" CHECK (
    (
      "status" = 'PROCESSING'
      AND "completed_at" IS NULL
      AND "error_code" IS NULL
      AND "flood_detected" IS NULL
      AND "suggested_severity" IS NULL
      AND "confidence_score" IS NULL
      AND "water_level_category" IS NULL
      AND "road_passability" IS NULL
      AND "image_quality" IS NULL
      AND "summary" IS NULL
      AND "needs_human_review" IS NULL
      AND "model_name" IS NULL
      AND "model_version" IS NULL
      AND "processing_time_ms" IS NULL
    )
    OR (
      "status" = 'SUCCEEDED'
      AND "completed_at" IS NOT NULL
      AND "error_code" IS NULL
      AND "flood_detected" IS NOT NULL
      AND "suggested_severity" IS NOT NULL
      AND "confidence_score" IS NOT NULL
      AND "water_level_category" IS NOT NULL
      AND "road_passability" IS NOT NULL
      AND "image_quality" IS NOT NULL
      AND "summary" IS NOT NULL
      AND "needs_human_review" IS NOT NULL
      AND "model_name" IS NOT NULL
      AND "model_version" IS NOT NULL
      AND "processing_time_ms" IS NOT NULL
    )
    OR (
      "status" IN ('FAILED', 'TIMED_OUT')
      AND "completed_at" IS NOT NULL
      AND "error_code" IS NOT NULL
      AND "flood_detected" IS NULL
      AND "suggested_severity" IS NULL
      AND "confidence_score" IS NULL
      AND "water_level_category" IS NULL
      AND "road_passability" IS NULL
      AND "image_quality" IS NULL
      AND "summary" IS NULL
      AND "needs_human_review" IS NULL
      AND "model_name" IS NULL
      AND "model_version" IS NULL
      AND "processing_time_ms" IS NULL
    )
  )
);

CREATE TRIGGER "report_drafts_set_updated_at" BEFORE UPDATE ON "report_drafts" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "ai_analyses_set_updated_at" BEFORE UPDATE ON "ai_analyses" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE INDEX "flood_reports_final_severity_idx" ON "flood_reports"("final_severity");
CREATE INDEX "report_drafts_reporter_id_created_at_id_idx" ON "report_drafts"("reporter_id", "created_at", "id");
CREATE INDEX "report_drafts_expires_at_idx" ON "report_drafts"("expires_at");
CREATE INDEX "ai_analyses_status_created_at_idx" ON "ai_analyses"("status", "created_at");
