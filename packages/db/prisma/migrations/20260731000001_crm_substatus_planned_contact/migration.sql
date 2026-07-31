-- CRM: explain why a client is still open, and make follow-ups deliberate.
--
-- `subStatus` answers "he's Active — but why is he still sitting there?".
-- `nextContactAt` stops being derived from a cadence and becomes an actual
-- appointment the team made; auto-generated due dates turned every card red and
-- the team learned to ignore the colour.

CREATE TYPE "LeadSubStatus" AS ENUM (
  'SEARCHING', 'AWAITING_REPLY', 'NEEDS_OPTIONS', 'BUDGET_MISMATCH',
  'FINANCING', 'PAUSED', 'DOCS_PENDING', 'PRICE_REVIEW'
);

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'FACEBOOK_AD';

ALTER TABLE "leads" ADD COLUMN "subStatus" "LeadSubStatus";
ALTER TABLE "leads" ADD COLUMN "nextContactNote" TEXT;
ALTER TABLE "leads" ADD COLUMN "waId" TEXT;
ALTER TABLE "leads" ADD COLUMN "externalLeadId" TEXT;

ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- The board no longer has a New column: an untouched client is simply an
-- active one nobody has called yet.
UPDATE "leads" SET "status" = 'ACTIVE' WHERE "status" = 'NEW';

-- Cadence-derived follow-up dates were never appointments anyone made. Clear
-- the ones that no contact log backs up, so the board starts honest.
UPDATE "leads" SET "nextContactAt" = NULL
 WHERE "nextContactAt" IS NOT NULL
   AND "status" NOT IN ('WON', 'LOST', 'ARCHIVED');

CREATE UNIQUE INDEX "leads_waId_key" ON "leads"("waId");
CREATE UNIQUE INDEX "leads_externalLeadId_key" ON "leads"("externalLeadId");
CREATE INDEX "leads_subStatus_idx" ON "leads"("subStatus");
