-- Touch timeline: email messages and recorded meetings per lead (calls are
-- read from "call"), plus the HubSpot activity id for meetings and email
-- thread notes written from deal signals.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

-- Nullable column with no default: metadata-only, no table rewrite.
ALTER TABLE "deal_signal" ADD COLUMN "crmActivityId" TEXT;

CREATE TABLE "deal_touchpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "direction" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "threadId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_touchpoint_pkey" PRIMARY KEY ("id")
);

-- @allow-non-concurrent-index: table is empty at creation
CREATE UNIQUE INDEX "deal_touchpoint_organizationId_source_sourceId_leadId_key" ON "deal_touchpoint"("organizationId", "source", "sourceId", "leadId");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "deal_touchpoint_organizationId_occurredAt_idx" ON "deal_touchpoint"("organizationId", "occurredAt");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "deal_touchpoint_leadId_occurredAt_idx" ON "deal_touchpoint"("leadId", "occurredAt");

ALTER TABLE "deal_touchpoint"
    ADD CONSTRAINT "deal_touchpoint_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_touchpoint"
    ADD CONSTRAINT "deal_touchpoint_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_touchpoint" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_touchpoint_select" ON "deal_touchpoint" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "deal_touchpoint_insert" ON "deal_touchpoint" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "deal_touchpoint_update" ON "deal_touchpoint" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "deal_touchpoint_delete" ON "deal_touchpoint" FOR DELETE TO authenticated USING (false);
CREATE POLICY "deal_touchpoint_anon"   ON "deal_touchpoint" FOR ALL TO anon USING (false);
