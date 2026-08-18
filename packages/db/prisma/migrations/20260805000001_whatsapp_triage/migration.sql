-- WhatsApp triage: unknown senders wait in an inbox instead of becoming clients.
--
-- A work number receives suppliers, family, wrong numbers and spam alongside
-- real enquiries. Turning every one of those into a CRM client is how the
-- pipeline stops being trustworthy — so unknown senders land here and a person
-- decides. Known numbers skip this and go straight onto their own timeline.

CREATE TYPE "InboundChannel" AS ENUM ('WHATSAPP');
CREATE TYPE "InboundStatus" AS ENUM ('PENDING', 'ADDED', 'IGNORED', 'BLOCKED');

CREATE TABLE "inbound_messages" (
  "id"          TEXT NOT NULL,
  "channel"     "InboundChannel" NOT NULL DEFAULT 'WHATSAPP',
  "waId"        TEXT NOT NULL,
  "profileName" TEXT,
  "body"        TEXT NOT NULL,
  "status"      "InboundStatus" NOT NULL DEFAULT 'PENDING',
  "leadId"      TEXT,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledAt"   TIMESTAMP(3),
  "handledBy"   TEXT,
  CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inbound_messages_status_receivedAt_idx" ON "inbound_messages"("status", "receivedAt");
CREATE INDEX "inbound_messages_waId_idx" ON "inbound_messages"("waId");

CREATE TABLE "blocked_senders" (
  "id"        TEXT NOT NULL,
  "waId"      TEXT NOT NULL,
  "label"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blocked_senders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blocked_senders_waId_key" ON "blocked_senders"("waId");
