-- Migration: Convert properties into projects with units and unit options
--
-- Previously each property row carried a single bedrooms/bathrooms/area/floor
-- combination. Going forward, a property represents a project that can contain
-- many Units, and each Unit can have many UnitOptions (e.g. Turnkey / White
-- Frame / Black Frame) priced per square metre.
--
-- This migration:
--   1. Creates the new `units` and `unit_options` tables
--   2. Backfills one default Unit per existing property (preserving bedrooms,
--      bathrooms, area, floor) and a default "Turnkey" UnitOption with
--      pricePerSqm derived from the existing price / area
--   3. Drops the now-redundant columns from `properties`

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitNumber" TEXT,
    "bedrooms" INTEGER NOT NULL DEFAULT 1,
    "bathrooms" INTEGER NOT NULL DEFAULT 1,
    "area" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER,
    "parkingSpaces" INTEGER DEFAULT 0,
    "notes" TEXT,
    "availabilityStatus" "PropertyAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "units_propertyId_idx" ON "units"("propertyId");
CREATE INDEX "units_availabilityStatus_idx" ON "units"("availabilityStatus");

ALTER TABLE "units"
    ADD CONSTRAINT "units_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "unit_options" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerSqm" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "initialPayment" DOUBLE PRECISION,
    "paymentPlanDetails" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "unit_options_unitId_idx" ON "unit_options"("unitId");

ALTER TABLE "unit_options"
    ADD CONSTRAINT "unit_options_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill: create one Unit + one "Turnkey" UnitOption per existing property
--    Only properties with a positive area produce data; others will need a
--    unit added manually from the admin UI.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "units" (
    "id",
    "propertyId",
    "name",
    "bedrooms",
    "bathrooms",
    "area",
    "floor",
    "parkingSpaces",
    "availabilityStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    'unit_' || p."id",
    p."id",
    'Unit 1',
    COALESCE(p."bedrooms", 1),
    COALESCE(p."bathrooms", 1),
    p."area",
    p."floor",
    COALESCE(p."parkingSpaces", 0),
    p."availabilityStatus",
    p."createdAt",
    NOW()
FROM "properties" p
WHERE p."area" IS NOT NULL AND p."area" > 0;

INSERT INTO "unit_options" (
    "id",
    "unitId",
    "name",
    "pricePerSqm",
    "currency",
    "createdAt",
    "updatedAt"
)
SELECT
    'opt_' || p."id",
    'unit_' || p."id",
    'Turnkey',
    CASE
        WHEN p."area" > 0 THEN p."price" / p."area"
        ELSE p."price"
    END,
    COALESCE(p."currency", 'USD'),
    p."createdAt",
    NOW()
FROM "properties" p
WHERE p."area" IS NOT NULL AND p."area" > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop legacy per-property unit columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "properties" DROP COLUMN IF EXISTS "bedrooms";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "bathrooms";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "area";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "floor";
