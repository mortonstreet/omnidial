-- CreateTable
CREATE TABLE IF NOT EXISTS "error_log" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "callId" TEXT,
    "campaignId" TEXT,
    "leadId" TEXT,
    "twilioCallSid" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT,
    "requestId" TEXT,
    "stackTrace" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "error_log_organizationId_idx" ON "error_log"("organizationId");
CREATE INDEX IF NOT EXISTS "error_log_severity_idx" ON "error_log"("severity");
CREATE INDEX IF NOT EXISTS "error_log_product_idx" ON "error_log"("product");
CREATE INDEX IF NOT EXISTS "error_log_category_idx" ON "error_log"("category");
CREATE INDEX IF NOT EXISTS "error_log_occurredAt_idx" ON "error_log"("occurredAt");
CREATE INDEX IF NOT EXISTS "error_log_status_idx" ON "error_log"("status");
