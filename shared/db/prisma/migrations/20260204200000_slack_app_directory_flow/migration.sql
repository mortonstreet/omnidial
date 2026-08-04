-- AlterTable: Make organizationId nullable and add isPending
ALTER TABLE "slack_workspace" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "slack_workspace" ADD COLUMN IF NOT EXISTS "isPending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: SlackLinkToken for secure workspace-to-org linking
CREATE TABLE IF NOT EXISTS "slack_link_token" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_link_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "slack_link_token_token_key" ON "slack_link_token"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "slack_link_token_token_idx" ON "slack_link_token"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "slack_link_token_workspaceId_idx" ON "slack_link_token"("workspaceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'slack_link_token_workspaceId_fkey'
    ) THEN
        ALTER TABLE "slack_link_token" ADD CONSTRAINT "slack_link_token_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "slack_workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
