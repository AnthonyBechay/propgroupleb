-- Repeatable unit types.
--
-- We're the broker, not the developer: in a Georgian development "1 bedroom" is
-- a template many clients buy, and we neither know nor track how many exist. A
-- type never sells out and never leaves the matcher. Which actual apartment a
-- client ended up with is recorded on the deal, where it's known.

ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "isUnitType" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lead_opportunities" ADD COLUMN IF NOT EXISTS "soldUnitRef" TEXT;

-- Everything imported from the Georgia system is a type by nature.
UPDATE "units" u SET "isUnitType" = true
  FROM "buildings" b
 WHERE b."id" = u."buildingId" AND b."country" <> 'LEBANON';
