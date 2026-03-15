/*
  Warnings:

  - You are about to drop the `contact_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `exchange_rates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `legal_compliance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `maintenance_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `marketing_campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `membership_benefits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `newsletter_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_comparisons` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_reviews` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_updates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `property_views` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `referrals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `saved_searches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_portfolio_analytics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "maintenance_requests" DROP CONSTRAINT "maintenance_requests_userId_fkey";

-- DropForeignKey
ALTER TABLE "property_comparisons" DROP CONSTRAINT "property_comparisons_userId_fkey";

-- DropForeignKey
ALTER TABLE "property_reviews" DROP CONSTRAINT "property_reviews_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "property_reviews" DROP CONSTRAINT "property_reviews_userId_fkey";

-- DropForeignKey
ALTER TABLE "property_updates" DROP CONSTRAINT "property_updates_propertyId_fkey";

-- DropTable
DROP TABLE "contact_requests";

-- DropTable
DROP TABLE "exchange_rates";

-- DropTable
DROP TABLE "legal_compliance";

-- DropTable
DROP TABLE "maintenance_requests";

-- DropTable
DROP TABLE "marketing_campaigns";

-- DropTable
DROP TABLE "membership_benefits";

-- DropTable
DROP TABLE "newsletter_subscriptions";

-- DropTable
DROP TABLE "property_comparisons";

-- DropTable
DROP TABLE "property_reviews";

-- DropTable
DROP TABLE "property_updates";

-- DropTable
DROP TABLE "property_views";

-- DropTable
DROP TABLE "referrals";

-- DropTable
DROP TABLE "saved_searches";

-- DropTable
DROP TABLE "user_portfolio_analytics";

-- DropEnum
DROP TYPE "CampaignStatus";

-- DropEnum
DROP TYPE "MaintenanceRequestPriority";

-- DropEnum
DROP TYPE "MaintenanceRequestStatus";

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateTable
CREATE TABLE "site_content" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_media" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "site_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_content_key_key" ON "site_content"("key");

-- CreateIndex
CREATE INDEX "site_content_section_idx" ON "site_content"("section");

-- CreateIndex
CREATE INDEX "site_content_isActive_idx" ON "site_content"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "site_media_key_key" ON "site_media"("key");

-- CreateIndex
CREATE INDEX "site_media_section_idx" ON "site_media"("section");

-- CreateIndex
CREATE INDEX "site_media_isActive_idx" ON "site_media"("isActive");
