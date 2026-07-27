-- Opportunities: track a client's interest in ONE specific property (or one
-- counterpart client), so a failed viewing rules out that property instead of
-- derailing the client relationship. Purely additive.

CREATE TYPE "OpportunityStage" AS ENUM (
  'SUGGESTED', 'SHARED', 'VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'WON', 'REJECTED'
);

CREATE TYPE "RejectionReason" AS ENUM (
  'PRICE_TOO_HIGH', 'TOO_SMALL', 'TOO_BIG', 'LOCATION', 'CONDITION', 'LAYOUT',
  'FLOOR_LEVEL', 'NO_PARKING', 'NOISE', 'NO_VIEW', 'NO_ELEVATOR', 'BUILDING_QUALITY',
  'CHANGED_MIND', 'BOUGHT_ELSEWHERE', 'UNAVAILABLE', 'OTHER'
);

CREATE TABLE "lead_opportunities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'SUGGESTED',
    "listingId" TEXT,
    "counterpartLeadId" TEXT,
    "matchScore" INTEGER,
    "viewingAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "rejectionReason" "RejectionReason",
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "lead_opportunities_pkey" PRIMARY KEY ("id")
);

-- One row per client x property (and per client x counterpart), so the matcher
-- can never re-suggest something already shown or rejected.
CREATE UNIQUE INDEX "lead_opportunities_leadId_listingId_key"         ON "lead_opportunities"("leadId", "listingId");
CREATE UNIQUE INDEX "lead_opportunities_leadId_counterpartLeadId_key" ON "lead_opportunities"("leadId", "counterpartLeadId");
CREATE INDEX "lead_opportunities_leadId_idx"    ON "lead_opportunities"("leadId");
CREATE INDEX "lead_opportunities_stage_idx"     ON "lead_opportunities"("stage");
CREATE INDEX "lead_opportunities_viewingAt_idx" ON "lead_opportunities"("viewingAt");

ALTER TABLE "lead_opportunities" ADD CONSTRAINT "lead_opportunities_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
