CREATE TYPE "LocationSource" AS ENUM ('DEVICE_GPS', 'MANUAL');
ALTER TABLE "flood_reports" ADD COLUMN "location_source" "LocationSource" NOT NULL DEFAULT 'DEVICE_GPS';
ALTER TABLE "flood_reports" ALTER COLUMN "gps_accuracy" DROP NOT NULL;
ALTER TABLE "flood_reports" DROP CONSTRAINT "flood_reports_gps_accuracy_check";
ALTER TABLE "flood_reports" ADD CONSTRAINT "flood_reports_location_source_accuracy_check" CHECK (("location_source" = 'DEVICE_GPS' AND "gps_accuracy" IS NOT NULL AND "gps_accuracy" > 0 AND "gps_accuracy" <= 100000) OR ("location_source" = 'MANUAL' AND "gps_accuracy" IS NULL));
