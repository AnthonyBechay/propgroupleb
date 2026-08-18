-- Fields the Georgia system has that this one lacked, so imported
-- international stock keeps all of its data.

ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "hasCentralAC"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3);
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "reservedUntil" TIMESTAMP(3);
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "soldAt"        TIMESTAMP(3);

-- Residency-by-investment is the first question an international buyer asks.
ALTER TABLE "building_investment_data" ADD COLUMN IF NOT EXISTS "isGoldenVisaEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "building_investment_data" ADD COLUMN IF NOT EXISTS "goldenVisaMinAmount"  DOUBLE PRECISION;
