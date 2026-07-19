-- Owner submissions (zero-commission campaign) + property source flag.
-- Non-destructive: new enums, one new column with default, one new table.

-- CreateEnum
CREATE TYPE "PropertySource" AS ENUM ('ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN "source" "PropertySource" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "property_submissions" (
    "id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "sellerName" TEXT NOT NULL,
    "sellerPhone" TEXT NOT NULL,
    "sellerEmail" TEXT,
    "preferredContact" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitKind" "UnitKind" NOT NULL DEFAULT 'APARTMENT',
    "intent" "ListingIntent" NOT NULL DEFAULT 'FOR_SALE',
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" DOUBLE PRECISION,
    "floor" INTEGER,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "mohafazat" TEXT,
    "caza" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "images" TEXT[],
    "adminNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_submissions_buildingId_key" ON "property_submissions"("buildingId");

-- CreateIndex
CREATE INDEX "property_submissions_status_idx" ON "property_submissions"("status");

-- CreateIndex
CREATE INDEX "property_submissions_createdAt_idx" ON "property_submissions"("createdAt");
