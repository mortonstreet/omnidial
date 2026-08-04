-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_admin_audit_log_admin" ON "admin_audit_log"("adminUserId");

-- CreateIndex
CREATE INDEX "idx_admin_audit_log_action" ON "admin_audit_log"("action");

-- CreateIndex
CREATE INDEX "idx_admin_audit_log_created" ON "admin_audit_log"("createdAt");
