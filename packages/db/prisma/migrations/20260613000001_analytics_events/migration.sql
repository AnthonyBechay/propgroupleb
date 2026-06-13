-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "listingId" TEXT,
    "buildingId" TEXT,
    "unitId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_type_idx" ON "analytics_events"("type");
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");
CREATE INDEX "analytics_events_listingId_idx" ON "analytics_events"("listingId");
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");
