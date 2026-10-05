-- Two-way CRM sync: provider account id for webhook routing, stored deal/task
-- ids instead of re-guessing, per-field local edit times for newest-wins
-- conflict resolution, call -> CRM activity link, and a sync audit trail.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

-- Nullable columns with no default: metadata-only, no table rewrite.
ALTER TABLE "integration" ADD COLUMN "externalAccountId" TEXT;

ALTER TABLE "crm_sync_record" ADD COLUMN "externalDealId" TEXT;
ALTER TABLE "crm_sync_record" ADD COLUMN "externalTaskId" TEXT;
ALTER TABLE "crm_sync_record" ADD COLUMN "lastPushedAt" TIMESTAMP(3);
ALTER TABLE "crm_sync_record" ADD COLUMN "lastPulledAt" TIMESTAMP(3);
ALTER TABLE "crm_sync_record" ADD COLUMN "pushedHash" TEXT;
ALTER TABLE "crm_sync_record" ADD COLUMN "remoteDeletedAt" TIMESTAMP(3);

ALTER TABLE "lead" ADD COLUMN "syncFieldUpdatedAt" JSONB;

ALTER TABLE "call" ADD COLUMN "crmActivityId" TEXT;

CREATE TABLE "crm_sync_event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_sync_event_pkey" PRIMARY KEY ("id")
);

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "crm_sync_event_organizationId_createdAt_idx" ON "crm_sync_event"("organizationId", "createdAt");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "crm_sync_event_leadId_createdAt_idx" ON "crm_sync_event"("leadId", "createdAt");

ALTER TABLE "crm_sync_event"
    ADD CONSTRAINT "crm_sync_event_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit rows outlive the lead they describe, so no lead FK.

ALTER TABLE "crm_sync_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sync_event_select" ON "crm_sync_event" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "crm_sync_event_insert" ON "crm_sync_event" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "crm_sync_event_update" ON "crm_sync_event" FOR UPDATE TO authenticated USING (false);
CREATE POLICY "crm_sync_event_delete" ON "crm_sync_event" FOR DELETE TO authenticated USING (false);
CREATE POLICY "crm_sync_event_anon"   ON "crm_sync_event" FOR ALL TO anon USING (false);
