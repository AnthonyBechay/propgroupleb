-- AlterTable: Add inquiry phases
ALTER TABLE "property_inquiries" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "property_inquiries" ADD COLUMN "adminNotes" TEXT;
ALTER TABLE "property_inquiries" ADD COLUMN "repliedAt" TIMESTAMP(3);
ALTER TABLE "property_inquiries" ADD COLUMN "repliedBy" TEXT;
ALTER TABLE "property_inquiries" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "property_inquiries_status_idx" ON "property_inquiries"("status");

-- AlterTable: Add share token to properties
ALTER TABLE "properties" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "properties_shareToken_key" ON "properties"("shareToken");
