-- CreateEnum: InquiryStatus
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'REPLIED', 'CANCELLED', 'CLOSED');

-- AlterTable: Convert PropertyInquiry.status from TEXT to InquiryStatus enum
ALTER TABLE "property_inquiries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "property_inquiries" ALTER COLUMN "status" TYPE "InquiryStatus" USING "status"::"InquiryStatus";
ALTER TABLE "property_inquiries" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable: Add password reset fields to User
ALTER TABLE "users" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "users" ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex: unique constraint on resetToken
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

-- AddForeignKey: PropertyPriceHistory → Property (CASCADE)
ALTER TABLE "property_price_history" ADD CONSTRAINT "property_price_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterForeignKey: AdminAuditLog → User (RESTRICT → CASCADE)
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "admin_audit_logs_adminId_fkey";
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Transaction.sellerId → User (SET NULL)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: new indexes
CREATE INDEX "admin_audit_logs_targetType_idx" ON "admin_audit_logs"("targetType");
CREATE INDEX "transactions_sellerId_idx" ON "transactions"("sellerId");
CREATE INDEX "messages_parentMessageId_idx" ON "messages"("parentMessageId");
