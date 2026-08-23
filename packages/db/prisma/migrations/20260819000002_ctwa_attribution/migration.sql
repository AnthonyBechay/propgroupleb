-- Click-to-WhatsApp ad attribution.
--
-- Meta tells us which ad a WhatsApp conversation started from. Without keeping
-- it, ad spend can only be judged on message volume — not on whether those
-- messages ever became clients or commission.

ALTER TABLE "inbound_messages" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "inbound_messages" ADD COLUMN IF NOT EXISTS "adId"       TEXT;
ALTER TABLE "inbound_messages" ADD COLUMN IF NOT EXISTS "adHeadline" TEXT;
ALTER TABLE "leads"            ADD COLUMN IF NOT EXISTS "adId"       TEXT;

CREATE INDEX IF NOT EXISTS "leads_adId_idx" ON "leads"("adId");
