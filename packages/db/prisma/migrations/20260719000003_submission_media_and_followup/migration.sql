-- Seller videos + free-photo-visit request, and internal follow-up steps.
-- Non-destructive: new columns with defaults.
ALTER TABLE "property_submissions" ADD COLUMN "videos" TEXT[];
ALTER TABLE "property_submissions" ADD COLUMN "wantsPhotoVisit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "property_submissions" ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "property_submissions" ADD COLUMN "dataCollected" BOOLEAN NOT NULL DEFAULT false;
