-- Optional seller-provided extras on submissions. Non-destructive: two nullable columns.
ALTER TABLE "property_submissions" ADD COLUMN "extraDetails" TEXT;
ALTER TABLE "property_submissions" ADD COLUMN "locationUrl" TEXT;
