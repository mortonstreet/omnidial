-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "power_dialer_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "dialedCount" INTEGER NOT NULL DEFAULT 0,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "power_dialer_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_organizationId_createdAt_idx" ON "activity"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_type_idx" ON "activity"("type");

-- CreateIndex
CREATE INDEX "schedule_event_userId_startTime_idx" ON "schedule_event"("userId", "startTime");

-- CreateIndex
CREATE INDEX "schedule_event_organizationId_startTime_idx" ON "schedule_event"("organizationId", "startTime");

-- CreateIndex
CREATE INDEX "script_organizationId_idx" ON "script"("organizationId");

-- CreateIndex
CREATE INDEX "script_campaignId_idx" ON "script"("campaignId");

-- CreateIndex
CREATE INDEX "power_dialer_progress_userId_idx" ON "power_dialer_progress"("userId");

-- CreateIndex
CREATE INDEX "power_dialer_progress_campaignId_idx" ON "power_dialer_progress"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "power_dialer_progress_userId_campaignId_listId_key" ON "power_dialer_progress"("userId", "campaignId", "listId");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_event" ADD CONSTRAINT "schedule_event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script" ADD CONSTRAINT "script_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script" ADD CONSTRAINT "script_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_dialer_progress" ADD CONSTRAINT "power_dialer_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_dialer_progress" ADD CONSTRAINT "power_dialer_progress_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_dialer_progress" ADD CONSTRAINT "power_dialer_progress_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lead_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;
