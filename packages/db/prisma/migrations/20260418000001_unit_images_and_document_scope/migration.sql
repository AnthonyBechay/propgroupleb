-- Migration: Unit images + document hierarchy (unit/option scope)
--
-- Changes:
--   1. Add `images TEXT[]` column to `units` table
--   2. Add `unitId` and `unitOptionId` FKs to `property_documents` table
--      so documents can be scoped to a specific unit or finish option

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Unit images
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "units"
    ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Document scope columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "property_documents"
    ADD COLUMN IF NOT EXISTS "unitId" TEXT,
    ADD COLUMN IF NOT EXISTS "unitOptionId" TEXT;

ALTER TABLE "property_documents"
    ADD CONSTRAINT "property_documents_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_documents"
    ADD CONSTRAINT "property_documents_unitOptionId_fkey"
    FOREIGN KEY ("unitOptionId") REFERENCES "unit_options"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "property_documents_unitId_idx"
    ON "property_documents"("unitId");

CREATE INDEX IF NOT EXISTS "property_documents_unitOptionId_idx"
    ON "property_documents"("unitOptionId");
