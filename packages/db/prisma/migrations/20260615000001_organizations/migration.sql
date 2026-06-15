-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('AGENCY', 'PM_COMPANY');
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN');

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'PM_COMPANY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MANAGER',
    "title" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_type_idx" ON "organizations"("type");
CREATE INDEX "organizations_isActive_idx" ON "organizations"("isActive");
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");
CREATE INDEX "organization_members_role_idx" ON "organization_members"("role");
CREATE INDEX "buildings_organizationId_idx" ON "buildings"("organizationId");
CREATE INDEX "maintenance_tickets_assignedToUserId_idx" ON "maintenance_tickets"("assignedToUserId");

-- Foreign keys
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
