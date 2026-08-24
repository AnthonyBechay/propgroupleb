-- "Investor" is not a fifth kind of client.
--
-- An investor is a buyer with a different motive, so being one is a property of
-- the person rather than a category beside buying and selling. Four intents
-- remain: buying, selling, looking to rent, renting out.
--
-- The INVESTOR enum value is deliberately left in place — Postgres cannot drop
-- an enum value, and an unused one is harmless. The application no longer
-- offers it.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "isInvestor" BOOLEAN NOT NULL DEFAULT false;

UPDATE "leads" SET "isInvestor" = true, "type" = 'BUYER' WHERE "type" = 'INVESTOR';
