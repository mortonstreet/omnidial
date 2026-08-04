-- CreateTable: custom_field_schema
CREATE TABLE IF NOT EXISTS "custom_field_schema" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "validationRule" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_schema_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_template
CREATE TABLE IF NOT EXISTS "research_template" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "targetUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractionSchema" JSONB NOT NULL DEFAULT '{}',
    "fieldMappings" JSONB NOT NULL DEFAULT '{}',
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_task
CREATE TABLE IF NOT EXISTS "research_task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT,
    "customPrompt" TEXT,
    "targetUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "rawResults" JSONB,
    "extractedData" JSONB,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "crawlCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_approval
CREATE TABLE IF NOT EXISTS "research_approval" (
    "id" TEXT NOT NULL,
    "researchTaskId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fieldSchemaId" TEXT,
    "fieldName" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "currentValue" TEXT,
    "proposedValue" TEXT NOT NULL,
    "source" TEXT,
    "confidence" DECIMAL(5,4),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "modifiedValue" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_history
CREATE TABLE IF NOT EXISTS "research_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "taskId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: custom_field_schema
CREATE UNIQUE INDEX IF NOT EXISTS "custom_field_schema_organizationId_name_key" ON "custom_field_schema"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "custom_field_schema_organizationId_isActive_idx" ON "custom_field_schema"("organizationId", "isActive");

-- CreateIndex: research_template
CREATE INDEX IF NOT EXISTS "research_template_organizationId_isActive_idx" ON "research_template"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "research_template_isSystemTemplate_idx" ON "research_template"("isSystemTemplate");

-- CreateIndex: research_task
CREATE INDEX IF NOT EXISTS "research_task_organizationId_status_idx" ON "research_task"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "research_task_leadId_idx" ON "research_task"("leadId");
CREATE INDEX IF NOT EXISTS "research_task_status_priority_idx" ON "research_task"("status", "priority" DESC);

-- CreateIndex: research_approval
CREATE INDEX IF NOT EXISTS "research_approval_researchTaskId_idx" ON "research_approval"("researchTaskId");
CREATE INDEX IF NOT EXISTS "research_approval_leadId_status_idx" ON "research_approval"("leadId", "status");
CREATE INDEX IF NOT EXISTS "research_approval_status_idx" ON "research_approval"("status");

-- CreateIndex: research_history
CREATE INDEX IF NOT EXISTS "research_history_organizationId_createdAt_idx" ON "research_history"("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "research_history_leadId_idx" ON "research_history"("leadId");
CREATE INDEX IF NOT EXISTS "research_history_taskId_idx" ON "research_history"("taskId");

-- AddForeignKey
ALTER TABLE "research_task" ADD CONSTRAINT "research_task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "research_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_approval" ADD CONSTRAINT "research_approval_researchTaskId_fkey" FOREIGN KEY ("researchTaskId") REFERENCES "research_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_approval" ADD CONSTRAINT "research_approval_fieldSchemaId_fkey" FOREIGN KEY ("fieldSchemaId") REFERENCES "custom_field_schema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_history" ADD CONSTRAINT "research_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "research_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
