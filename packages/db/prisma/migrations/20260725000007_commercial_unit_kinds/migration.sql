-- Commercial property types. Purely additive: no existing enum member is
-- removed or renamed, and no row is rewritten — every property already in the
-- system keeps its type and keeps working exactly as before.
ALTER TYPE "UnitKind" ADD VALUE IF NOT EXISTS 'SHOWROOM';
ALTER TYPE "UnitKind" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "UnitKind" ADD VALUE IF NOT EXISTS 'RESTAURANT';
ALTER TYPE "UnitKind" ADD VALUE IF NOT EXISTS 'CLINIC';
ALTER TYPE "UnitKind" ADD VALUE IF NOT EXISTS 'WHOLE_BUILDING';
