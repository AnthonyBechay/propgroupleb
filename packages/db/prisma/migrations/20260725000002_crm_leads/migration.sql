-- CRM: buyer/seller leads + follow-up log. Purely additive.

CREATE TYPE "LeadType"       AS ENUM ('BUYER', 'SELLER', 'RENTER', 'LANDLORD', 'INVESTOR');
CREATE TYPE "LeadStatus"     AS ENUM ('NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING', 'WON', 'LOST', 'ARCHIVED');
CREATE TYPE "LeadSource"     AS ENUM ('MANUAL', 'INQUIRY', 'FAVORITE', 'SUBMISSION', 'REFERRAL', 'WHATSAPP', 'PHONE', 'WALK_IN');
CREATE TYPE "LeadMarket"     AS ENUM ('LEBANON', 'GEORGIA');
CREATE TYPE "ContactChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VIEWING', 'NOTE');

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "market" "LeadMarket" NOT NULL DEFAULT 'LEBANON',
    "type" "LeadType" NOT NULL DEFAULT 'BUYER',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "askingFor" TEXT,
    "unitKinds" "UnitKind"[],
    "areas" TEXT[],
    "mohafazat" TEXT,
    "caza" TEXT,
    "city" TEXT,
    "minBeds" INTEGER,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "lastContactAt" TIMESTAMP(3),
    "contactIntervalDays" INTEGER NOT NULL DEFAULT 7,
    "nextContactAt" TIMESTAMP(3),
    "notes" TEXT,
    "userId" TEXT,
    "listingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_market_idx"        ON "leads"("market");
CREATE INDEX "leads_status_idx"        ON "leads"("status");
CREATE INDEX "leads_type_idx"          ON "leads"("type");
CREATE INDEX "leads_nextContactAt_idx" ON "leads"("nextContactAt");
CREATE INDEX "leads_userId_idx"        ON "leads"("userId");
CREATE INDEX "leads_createdAt_idx"     ON "leads"("createdAt");

CREATE TABLE "lead_contacts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL DEFAULT 'CALL',
    "body" TEXT NOT NULL,
    "outcome" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_contacts_leadId_idx"      ON "lead_contacts"("leadId");
CREATE INDEX "lead_contacts_contactedAt_idx" ON "lead_contacts"("contactedAt");

ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
