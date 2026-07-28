-- Track when a client relationship closed (WON/LOST) so the board can show only
-- recent wins rather than accumulating closed deals forever. Backfill from
-- updatedAt — the best available approximation for rows closed before this
-- column existed.
ALTER TABLE "leads" ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "leads" SET "closedAt" = "updatedAt" WHERE "status" IN ('WON', 'LOST');
