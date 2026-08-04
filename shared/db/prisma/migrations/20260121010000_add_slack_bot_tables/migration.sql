-- CreateTable
CREATE TABLE "slack_workspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamDomain" TEXT,
    "botToken" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "enterpriseId" TEXT,
    "enterpriseName" TEXT,
    "installedById" TEXT,
    "installedBySlackId" TEXT,
    "defaultChannelId" TEXT,
    "settings" JSONB DEFAULT '{}',
    "isActive" BOOLEAN DEFAULT true,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_user_link" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "slackEmail" TEXT,
    "slackDisplayName" TEXT,
    "slackRealName" TEXT,
    "slackTimezone" TEXT,
    "notificationsEnabled" BOOLEAN DEFAULT true,
    "dmChannelId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_user_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_notification_rule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT,
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN DEFAULT true,
    "config" JSONB DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_notification_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_message_log" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageTs" TEXT,
    "eventType" TEXT,
    "payload" JSONB,
    "success" BOOLEAN DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_message_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspace_teamId_key" ON "slack_workspace"("teamId");

-- CreateIndex
CREATE INDEX "slack_workspace_organizationId_idx" ON "slack_workspace"("organizationId");

-- CreateIndex
CREATE INDEX "slack_workspace_teamId_idx" ON "slack_workspace"("teamId");

-- CreateIndex
CREATE INDEX "slack_user_link_userId_idx" ON "slack_user_link"("userId");

-- CreateIndex
CREATE INDEX "slack_user_link_slackUserId_idx" ON "slack_user_link"("slackUserId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_link_workspaceId_userId_key" ON "slack_user_link"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_link_workspaceId_slackUserId_key" ON "slack_user_link"("workspaceId", "slackUserId");

-- CreateIndex
CREATE INDEX "slack_notification_rule_workspaceId_idx" ON "slack_notification_rule"("workspaceId");

-- CreateIndex
CREATE INDEX "slack_notification_rule_eventType_idx" ON "slack_notification_rule"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "slack_notification_rule_workspaceId_channelId_eventType_key" ON "slack_notification_rule"("workspaceId", "channelId", "eventType");

-- CreateIndex
CREATE INDEX "slack_message_log_workspaceId_createdAt_idx" ON "slack_message_log"("workspaceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "slack_workspace" ADD CONSTRAINT "slack_workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_workspace" ADD CONSTRAINT "slack_workspace_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_user_link" ADD CONSTRAINT "slack_user_link_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "slack_workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_user_link" ADD CONSTRAINT "slack_user_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_notification_rule" ADD CONSTRAINT "slack_notification_rule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "slack_workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_notification_rule" ADD CONSTRAINT "slack_notification_rule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_message_log" ADD CONSTRAINT "slack_message_log_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "slack_workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
