CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "ReportCategory" AS ENUM ('ROAD_WATERLOGGING', 'FLOODED_ROAD', 'CLOGGED_DRAIN', 'OVERFLOWING_DRAIN', 'OPEN_MANHOLE', 'FALLEN_TREE', 'STRANDED_VEHICLE', 'UNDERPASS_FLOODING', 'OTHER');
CREATE TYPE "Severity" AS ENUM ('UNKNOWN', 'MINOR', 'MODERATE', 'SEVERE', 'IMPASSABLE');
CREATE TYPE "VerificationStatus" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'PROVISIONAL', 'VERIFIED', 'DISPUTED', 'REJECTED', 'RESOLVED', 'STALE');
CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE', 'MONITORING', 'RESOLVED', 'STALE');
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "email" varchar(254) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "is_active" boolean NOT NULL DEFAULT true,
  "failed_login_attempts" integer NOT NULL DEFAULT 0 CHECK ("failed_login_attempts" >= 0),
  "failed_login_window_started_at" timestamptz(3),
  "locked_until" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("email" = lower("email"))
);
CREATE TABLE "incidents" (
  "id" uuid PRIMARY KEY,
  "category" "ReportCategory" NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'UNKNOWN',
  "confidence_score" decimal(5,4) CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0 AND "confidence_score" <= 1)),
  "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
  "latitude" decimal(9,6) NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" decimal(9,6) NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "first_reported_at" timestamptz(3) NOT NULL,
  "last_reported_at" timestamptz(3) NOT NULL CHECK ("last_reported_at" >= "first_reported_at"),
  "location" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision),4326)::geography) STORED NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "refresh_sessions" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "token_hash" char(64) NOT NULL UNIQUE,
  "family_id" uuid NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "revoked_at" timestamptz(3),
  "replaced_by_id" uuid UNIQUE REFERENCES "refresh_sessions"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" inet NOT NULL,
  "user_agent" varchar(512)
);
CREATE TABLE "flood_reports" (
  "id" uuid PRIMARY KEY,
  "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "category" "ReportCategory" NOT NULL,
  "description" varchar(1000),
  "severity_claim" "Severity" NOT NULL DEFAULT 'UNKNOWN',
  "latitude" decimal(9,6) NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" decimal(9,6) NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "gps_accuracy" decimal(10,2) NOT NULL CHECK ("gps_accuracy" > 0 AND "gps_accuracy" <= 100000),
  "captured_at" timestamptz(3) NOT NULL,
  "submitted_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "image_path" varchar(255) NOT NULL,
  "upload_source" varchar(16) NOT NULL DEFAULT 'WEB',
  "verification_status" "VerificationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "incident_id" uuid REFERENCES "incidents"("id") ON DELETE SET NULL,
  "location" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision),4326)::geography) STORED NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" varchar(64) NOT NULL,
  "entity_type" varchar(32) NOT NULL,
  "entity_id" uuid NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_address" inet NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION "set_updated_at"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "incidents_set_updated_at" BEFORE UPDATE ON "incidents" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "flood_reports_set_updated_at" BEFORE UPDATE ON "flood_reports" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at", "id");
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");
CREATE INDEX "refresh_sessions_family_id_revoked_at_idx" ON "refresh_sessions"("family_id", "revoked_at");
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");
CREATE INDEX "flood_reports_reporter_id_submitted_at_id_idx" ON "flood_reports"("reporter_id", "submitted_at", "id");
CREATE INDEX "flood_reports_verification_status_submitted_at_id_idx" ON "flood_reports"("verification_status", "submitted_at", "id");
CREATE INDEX "flood_reports_category_idx" ON "flood_reports"("category");
CREATE INDEX "flood_reports_severity_claim_idx" ON "flood_reports"("severity_claim");
CREATE INDEX "flood_reports_incident_id_idx" ON "flood_reports"("incident_id");
CREATE INDEX "flood_reports_location_gist_idx" ON "flood_reports" USING GIST ("location" gist_geography_ops);
CREATE INDEX "incidents_location_gist_idx" ON "incidents" USING GIST ("location" gist_geography_ops);
CREATE INDEX "incidents_status_last_reported_at_id_idx" ON "incidents"("status", "last_reported_at", "id");
CREATE INDEX "incidents_category_idx" ON "incidents"("category");
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
