-- Provenance for rows imported from the Georgia system.
-- Makes the import idempotent, reversible and auditable.

CREATE TABLE "imported_records" (
  "id"           TEXT NOT NULL,
  "batch"        TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceTable"  TEXT NOT NULL,
  "sourceId"     TEXT NOT NULL,
  "targetTable"  TEXT NOT NULL,
  "targetId"     TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "imported_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "imported_records_source_key"
  ON "imported_records"("sourceSystem", "sourceTable", "sourceId", "targetTable");
CREATE INDEX "imported_records_batch_idx" ON "imported_records"("batch");
