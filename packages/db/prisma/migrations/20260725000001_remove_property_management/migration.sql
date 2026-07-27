-- Remove the property-management feature entirely (tenancies, maintenance,
-- utilities, service charges, vendors) and the multi-tenant org layer that
-- existed only to scope it. DESTRUCTIVE: these tables and their data are dropped.
-- Nothing outside the PM feature referenced them.

-- Drop child/dependent tables first (FKs cascade from parents, but explicit
-- ordering keeps this readable and safe to run on any state).
DROP TABLE IF EXISTS "bill_allocations" CASCADE;
DROP TABLE IF EXISTS "unit_expense_shares" CASCADE;
DROP TABLE IF EXISTS "building_expenses" CASCADE;
DROP TABLE IF EXISTS "service_charges" CASCADE;
DROP TABLE IF EXISTS "utility_bills" CASCADE;
DROP TABLE IF EXISTS "utility_readings" CASCADE;
DROP TABLE IF EXISTS "utility_meters" CASCADE;
DROP TABLE IF EXISTS "ticket_updates" CASCADE;
DROP TABLE IF EXISTS "ticket_photos" CASCADE;
DROP TABLE IF EXISTS "maintenance_tickets" CASCADE;
DROP TABLE IF EXISTS "rent_payments" CASCADE;
DROP TABLE IF EXISTS "tenancies" CASCADE;
DROP TABLE IF EXISTS "vendors" CASCADE;
DROP TABLE IF EXISTS "organization_members" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;

-- Building no longer belongs to an organization.
ALTER TABLE "buildings" DROP COLUMN IF EXISTS "organizationId";

-- Drop PM-only enum types.
DROP TYPE IF EXISTS "TenancyStatus";
DROP TYPE IF EXISTS "RentPaymentStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "TicketScope";
DROP TYPE IF EXISTS "TicketCategory";
DROP TYPE IF EXISTS "TicketPriority";
DROP TYPE IF EXISTS "TicketStatus";
DROP TYPE IF EXISTS "UtilityKind";
DROP TYPE IF EXISTS "AllocationMethod";
DROP TYPE IF EXISTS "AllocationStatus";
DROP TYPE IF EXISTS "ChargeStatus";
DROP TYPE IF EXISTS "BillStatus";
DROP TYPE IF EXISTS "ChargeCadence";
DROP TYPE IF EXISTS "OrgType";
DROP TYPE IF EXISTS "OrgRole";

-- Retire the PROPERTY_MANAGER role: demote anyone holding it, then rebuild the
-- enum without that member (Postgres can't drop an enum value in place).
UPDATE "users" SET "role" = 'USER' WHERE "role" = 'PROPERTY_MANAGER';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('USER', 'AGENT', 'ADMIN', 'SUPER_ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "Role_old";
