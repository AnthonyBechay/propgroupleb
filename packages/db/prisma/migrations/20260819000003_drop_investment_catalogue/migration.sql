-- Drop the investment catalogue.
--
-- It existed to give Georgia investors something to match against while that
-- stock lived on propgrp.com. Those projects are now real buildings, units and
-- listings in this database, so the catalogue was a second place to maintain
-- the same information — and the CRM already matches against the real records.

ALTER TABLE "lead_opportunities" DROP COLUMN IF EXISTS "productId";
DROP TABLE IF EXISTS "investment_products";
DROP TYPE IF EXISTS "InvestmentProductStatus";
