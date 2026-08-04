-- CreateTable
CREATE TABLE "webhook_event_receipt" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "status" TEXT NOT NULL,
    "hash" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_receipt_provider_eventId_key" ON "webhook_event_receipt"("provider", "eventId");

-- CreateIndex
CREATE INDEX "webhook_event_receipt_provider_status_processedAt_idx" ON "webhook_event_receipt"("provider", "status", "processedAt");
