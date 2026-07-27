-- CRM locations become multi-select, picked from the curated per-market
-- catalogue instead of free text. A lead can target specific areas, whole
-- regions, or both.

ALTER TABLE "leads" ADD COLUMN "regions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Carry existing single-value location data into the new arrays before dropping.
UPDATE "leads"
   SET "regions" = ARRAY["mohafazat"]
 WHERE "mohafazat" IS NOT NULL AND "mohafazat" <> '';

UPDATE "leads"
   SET "areas" = array_remove(
         array_cat("areas", ARRAY["city", "caza"]),
         NULL
       )
 WHERE "city" IS NOT NULL OR "caza" IS NOT NULL;

ALTER TABLE "leads" DROP COLUMN "mohafazat";
ALTER TABLE "leads" DROP COLUMN "caza";
ALTER TABLE "leads" DROP COLUMN "city";
