-- Add optional unit-level propertyType (overrides project-level when set).
-- Useful when one project contains multiple unit types (studios + apartments + villas).

ALTER TABLE "units" ADD COLUMN "propertyType" "PropertyType";
