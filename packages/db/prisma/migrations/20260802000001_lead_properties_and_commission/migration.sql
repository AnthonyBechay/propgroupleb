-- Sellers with more than one property, deals we didn't list, and the money.
--
-- A seller's own fields described a single asset, which breaks as soon as he
-- has two — so each saleable thing becomes its own row that buyers match
-- against independently. Opportunities gain an off-platform subject (a Batumi
-- studio on propgrp.com, another agency's stock) and the sale figures, so the
-- CRM can answer "what did we actually earn this quarter".

CREATE TYPE "LeadPropertyStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN');

CREATE TABLE "lead_properties" (
  "id"            TEXT NOT NULL,
  "leadId"        TEXT NOT NULL,
  "kind"          "UnitKind" NOT NULL DEFAULT 'APARTMENT',
  "title"         TEXT,
  "areas"         TEXT[],
  "region"        TEXT,
  "askingPrice"   DOUBLE PRECISION,
  "currency"      "Currency" NOT NULL DEFAULT 'USD',
  "bedrooms"      INTEGER,
  "areaSqm"       DOUBLE PRECISION,
  "status"        "LeadPropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
  "listingId"     TEXT,
  "externalUrl"   TEXT,
  "notes"         TEXT,
  "soldPrice"     DOUBLE PRECISION,
  "commissionUsd" DOUBLE PRECISION,
  "soldAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lead_properties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_properties_leadId_idx" ON "lead_properties"("leadId");
CREATE INDEX "lead_properties_status_idx" ON "lead_properties"("status");

ALTER TABLE "lead_properties"
  ADD CONSTRAINT "lead_properties_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_opportunities" ADD COLUMN "leadPropertyId" TEXT;
ALTER TABLE "lead_opportunities" ADD COLUMN "externalTitle"  TEXT;
ALTER TABLE "lead_opportunities" ADD COLUMN "externalUrl"    TEXT;
ALTER TABLE "lead_opportunities" ADD COLUMN "soldPrice"      DOUBLE PRECISION;
ALTER TABLE "lead_opportunities" ADD COLUMN "soldCurrency"   "Currency" NOT NULL DEFAULT 'USD';
ALTER TABLE "lead_opportunities" ADD COLUMN "commissionUsd"  DOUBLE PRECISION;
ALTER TABLE "lead_opportunities" ADD COLUMN "closedAt"       TIMESTAMP(3);

-- Seed each existing seller's single implied property from the fields that
-- used to describe it, so nobody loses stock in the move.
INSERT INTO "lead_properties" ("id", "leadId", "kind", "areas", "region", "askingPrice", "currency", "bedrooms", "notes", "createdAt", "updatedAt")
SELECT
  'lp_' || substr(md5(random()::text || l."id"), 1, 22),
  l."id",
  COALESCE(l."unitKinds"[1], 'APARTMENT'::"UnitKind"),
  l."areas",
  l."regions"[1],
  COALESCE(l."budgetMin", l."budgetMax"),
  l."currency",
  l."minBeds",
  l."askingFor",
  NOW(),
  NOW()
FROM "leads" l
WHERE l."type" IN ('SELLER', 'LANDLORD')
  AND l."status" NOT IN ('WON', 'LOST', 'ARCHIVED');
