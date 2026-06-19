-- Remove duplicated "fake" unit images now that photos live on the property.
-- Runs after the backfill migration, so the building already holds the photos.
-- Only clears a unit's images when they exactly match its building's images
-- (the duplicates created by the old create flow). Units with genuinely distinct
-- photos are left untouched, and building images are unaffected — so no real
-- photo is lost, and per-unit images remain possible in the future.
UPDATE "units" u
SET "images" = '{}'
FROM "buildings" b
WHERE u."buildingId" = b."id"
  AND array_length(u."images", 1) > 0
  AND u."images" = b."images";
