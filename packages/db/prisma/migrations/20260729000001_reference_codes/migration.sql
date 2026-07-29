-- Human-friendly reference codes, in one family so a code always tells you
-- which property it belongs to:
--
--   PG-1042     the property
--   PG-1042-1   its first unit
--   PG-1042-2   its second unit
--
-- Listings deliberately have no code of their own — a listing shows the code
-- of whatever it is selling, so a client quoting a code never leaves the team
-- hunting for which property it maps to.

ALTER TABLE "buildings" ADD COLUMN "ref" TEXT;
ALTER TABLE "units"     ADD COLUMN "ref" TEXT;

-- Property numbers come from a sequence: race-free under concurrent inserts,
-- and never reused after a delete (a recycled code would point a client at the
-- wrong property). Starts high enough that codes look like real references.
CREATE SEQUENCE IF NOT EXISTS building_ref_seq START WITH 1000;

-- Backfill existing rows in creation order, so the oldest property gets PG-1000.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
    FROM "buildings"
)
UPDATE "buildings" b
   SET "ref" = 'PG-' || (999 + ordered.rn)::text
  FROM ordered
 WHERE b."id" = ordered."id";

-- Move the sequence past whatever we just handed out.
SELECT setval('building_ref_seq', GREATEST(1000, (SELECT COUNT(*) FROM "buildings") + 1000));

-- Number units within each property in creation order, so unit 1 is the oldest.
WITH ordered AS (
  SELECT u."id",
         b."ref" AS building_ref,
         ROW_NUMBER() OVER (PARTITION BY u."buildingId" ORDER BY u."createdAt", u."id") AS rn
    FROM "units" u
    JOIN "buildings" b ON b."id" = u."buildingId"
   WHERE b."ref" IS NOT NULL
)
UPDATE "units" u
   SET "ref" = ordered.building_ref || '-' || ordered.rn::text
  FROM ordered
 WHERE u."id" = ordered."id";

CREATE UNIQUE INDEX "buildings_ref_key" ON "buildings"("ref");
CREATE UNIQUE INDEX "units_ref_key"     ON "units"("ref");
CREATE INDEX "buildings_ref_idx" ON "buildings"("ref");
CREATE INDEX "units_ref_idx"     ON "units"("ref");
