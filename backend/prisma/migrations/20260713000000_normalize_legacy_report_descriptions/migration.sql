UPDATE "flood_reports"
SET "description" = CASE
  WHEN "description" IS NULL OR btrim("description") = ''
    THEN 'Description not provided in legacy report.'
  ELSE btrim("description") || ' (legacy)'
END
WHERE "description" IS NULL
   OR char_length(btrim("description")) < 10;
