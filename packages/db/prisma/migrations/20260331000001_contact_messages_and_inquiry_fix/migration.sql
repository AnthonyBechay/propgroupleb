-- CreateTable: ContactMessage for storing contact form submissions
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add propertyTitle to PropertyInquiry to preserve title after property deletion
ALTER TABLE "property_inquiries" ADD COLUMN "propertyTitle" TEXT;

-- AlterTable: Make propertyId nullable on PropertyInquiry
ALTER TABLE "property_inquiries" ALTER COLUMN "propertyId" DROP NOT NULL;

-- DropForeignKey: Remove cascade delete on property_inquiries -> properties
ALTER TABLE "property_inquiries" DROP CONSTRAINT IF EXISTS "property_inquiries_propertyId_fkey";

-- AddForeignKey: Re-add with SetNull behavior
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Copy existing property titles into propertyTitle for all inquiries
UPDATE "property_inquiries" pi
SET "propertyTitle" = p."title"
FROM "properties" p
WHERE pi."propertyId" = p."id" AND pi."propertyTitle" IS NULL;
