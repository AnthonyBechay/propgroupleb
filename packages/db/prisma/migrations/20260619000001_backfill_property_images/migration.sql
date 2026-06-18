-- Consolidate photos onto the property (building) for the unified image model.
-- Non-destructive: only fills a building's images when it currently has NONE,
-- copying from its most-recently-updated unit that has photos. Unit images are
-- left untouched. This guarantees no property loses its photos when the public
-- site switched to reading building photos first.
UPDATE "buildings" b
SET "images" = u."images"
FROM (
  SELECT DISTINCT ON ("buildingId") "buildingId", "images"
  FROM "units"
  WHERE array_length("images", 1) > 0
  ORDER BY "buildingId", "updatedAt" DESC
) u
WHERE b."id" = u."buildingId"
  AND (b."images" IS NULL OR array_length(b."images", 1) IS NULL OR array_length(b."images", 1) = 0);
