-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "dialedCount" INTEGER NOT NULL DEFAULT 0,
    "connectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "linkedInUrl" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "pipelineStageId" TEXT,
    "dealValue" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_lead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dialOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_user" (
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "campaign_user_pkey" PRIMARY KEY ("campaignId","userId")
);

-- CreateTable
CREATE TABLE "twilio_config" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "authTokenEncrypted" TEXT NOT NULL,
    "phoneNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twilio_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call" (
    "id" TEXT NOT NULL,
    "twilioConfigId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "twilioCallSid" TEXT,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "dispositionId" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "recordingUrl" TEXT,
    "recordingSid" TEXT,
    "voicemailDropped" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voicemail_drop" (
    "id" TEXT NOT NULL,
    "twilioConfigId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voicemail_drop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposition" (
    "id" TEXT NOT NULL,
    "twilioConfigId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_organizationId_idx" ON "campaign"("organizationId");

-- CreateIndex
CREATE INDEX "campaign_createdById_idx" ON "campaign"("createdById");

-- CreateIndex
CREATE INDEX "lead_organizationId_idx" ON "lead"("organizationId");

-- CreateIndex
CREATE INDEX "lead_organizationId_phone_idx" ON "lead"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "pipeline_stage_organizationId_idx" ON "pipeline_stage"("organizationId");

-- CreateIndex
CREATE INDEX "task_organizationId_idx" ON "task"("organizationId");

-- CreateIndex
CREATE INDEX "task_userId_dueAt_idx" ON "task"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "note_organizationId_idx" ON "note"("organizationId");

-- CreateIndex
CREATE INDEX "note_leadId_idx" ON "note"("leadId");

-- CreateIndex
CREATE INDEX "campaign_lead_campaignId_idx" ON "campaign_lead"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_lead_assignedUserId_idx" ON "campaign_lead"("assignedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_lead_campaignId_leadId_key" ON "campaign_lead"("campaignId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "twilio_config_organizationId_key" ON "twilio_config"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "call_twilioCallSid_key" ON "call"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_twilioConfigId_idx" ON "call"("twilioConfigId");

-- CreateIndex
CREATE INDEX "call_userId_idx" ON "call"("userId");

-- CreateIndex
CREATE INDEX "call_leadId_idx" ON "call"("leadId");

-- CreateIndex
CREATE INDEX "call_campaignId_idx" ON "call"("campaignId");

-- CreateIndex
CREATE INDEX "call_direction_idx" ON "call"("direction");

-- CreateIndex
CREATE INDEX "call_startedAt_idx" ON "call"("startedAt");

-- CreateIndex
CREATE INDEX "voicemail_drop_twilioConfigId_idx" ON "voicemail_drop"("twilioConfigId");

-- CreateIndex
CREATE INDEX "voicemail_drop_userId_idx" ON "voicemail_drop"("userId");

-- CreateIndex
CREATE INDEX "disposition_twilioConfigId_idx" ON "disposition"("twilioConfigId");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_lead" ADD CONSTRAINT "campaign_lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_lead" ADD CONSTRAINT "campaign_lead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_lead" ADD CONSTRAINT "campaign_lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_user" ADD CONSTRAINT "campaign_user_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_user" ADD CONSTRAINT "campaign_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call" ADD CONSTRAINT "call_twilioConfigId_fkey" FOREIGN KEY ("twilioConfigId") REFERENCES "twilio_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call" ADD CONSTRAINT "call_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "disposition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voicemail_drop" ADD CONSTRAINT "voicemail_drop_twilioConfigId_fkey" FOREIGN KEY ("twilioConfigId") REFERENCES "twilio_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposition" ADD CONSTRAINT "disposition_twilioConfigId_fkey" FOREIGN KEY ("twilioConfigId") REFERENCES "twilio_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
