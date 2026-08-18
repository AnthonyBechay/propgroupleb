-- Georgia investment stock, mirrored into the CRM.
--
-- Lebanese buyers are matched against live listings on this site. Georgia
-- investors had nothing to match against — that inventory lives on propgrp.com
-- — so for half the business the CRM was a contact list. This is the minimum
-- mirror needed to answer "what can I offer this client" in one place.

CREATE TYPE "InvestmentProductStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'SOLD_OUT', 'PAUSED');

CREATE TABLE "investment_products" (
  "id"            TEXT NOT NULL,
  "market"        "LeadMarket" NOT NULL DEFAULT 'GEORGIA',
  "name"          TEXT NOT NULL,
  "developer"     TEXT,
  "city"          TEXT,
  "region"        TEXT,
  "unitKinds"     "UnitKind"[],
  "priceFrom"     DOUBLE PRECISION,
  "priceTo"       DOUBLE PRECISION,
  "currency"      "Currency" NOT NULL DEFAULT 'USD',
  "expectedYield" DOUBLE PRECISION,
  "handoverAt"    TIMESTAMP(3),
  "paymentPlan"   TEXT,
  "url"           TEXT,
  "images"        TEXT[],
  "notes"         TEXT,
  "status"        "InvestmentProductStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investment_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_products_market_idx" ON "investment_products"("market");
CREATE INDEX "investment_products_status_idx" ON "investment_products"("status");

ALTER TABLE "lead_opportunities" ADD COLUMN "productId" TEXT;
