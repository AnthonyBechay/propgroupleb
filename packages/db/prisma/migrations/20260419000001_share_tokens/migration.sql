-- Scoped share tokens: a single token can point at a whole property, a specific unit,
-- or a specific finish option. Public share view resolves the token and renders the
-- matching sub-tree + scoped documents.

CREATE TYPE "ShareScope" AS ENUM ('PROPERTY', 'UNIT', 'UNIT_OPTION');

CREATE TABLE "share_tokens" (
  "id"           TEXT         NOT NULL,
  "token"        TEXT         NOT NULL,
  "scope"        "ShareScope" NOT NULL,
  "propertyId"   TEXT         NOT NULL,
  "unitId"       TEXT,
  "unitOptionId" TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"    TIMESTAMP(3),
  "revokedAt"    TIMESTAMP(3),

  CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "share_tokens_token_key" ON "share_tokens"("token");
CREATE INDEX "share_tokens_propertyId_idx" ON "share_tokens"("propertyId");
CREATE INDEX "share_tokens_unitId_idx" ON "share_tokens"("unitId");
CREATE INDEX "share_tokens_unitOptionId_idx" ON "share_tokens"("unitOptionId");
