UPDATE "flood_reports"
SET "description" = 'Description not provided in legacy report.'
WHERE "description" IS NULL OR btrim("description") = '';

ALTER TABLE "flood_reports"
ALTER COLUMN "description" SET NOT NULL;

ALTER TABLE "flood_reports"
ADD CONSTRAINT "flood_reports_description_length_check"
CHECK (char_length(btrim("description")) BETWEEN 10 AND 1000);
