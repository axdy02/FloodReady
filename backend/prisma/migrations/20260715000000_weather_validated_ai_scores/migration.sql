ALTER TABLE "ai_analyses"
ADD COLUMN "validation_score" decimal(5,4),
ADD COLUMN "validation_outcome" varchar(32),
ADD COLUMN "weather_summary" varchar(500),
ADD COLUMN "weather_precipitation_mm" decimal(8,2),
ADD COLUMN "weather_temperature_c" decimal(5,2),
ADD COLUMN "weather_score" decimal(5,4);

ALTER TABLE "ai_analyses"
ADD CONSTRAINT "ai_analyses_validation_outcome_check"
CHECK ("validation_outcome" IS NULL OR "validation_outcome" IN ('ACCEPTED', 'NEEDS_REVIEW', 'REJECTED'));
