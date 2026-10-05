-- Deal tracking: stage history for pipeline velocity and stage conversion,
-- win/loss outcome + reason on the lead, and AI-scored deal signals from
-- calls, email threads and recorded meetings.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

-- Nullable columns with no default: metadata-only, no table rewrite.
ALTER TABLE "pipeline_stage" ADD COLUMN "outcome" TEXT;

ALTER TABLE "lead" ADD COLUMN "stageEnteredAt" TIMESTAMP(3);
ALTER TABLE "lead" ADD COLUMN "initialDealValue" DECIMAL(12,2);
ALTER TABLE "lead" ADD COLUMN "dealOutcome" TEXT;
ALTER TABLE "lead" ADD COLUMN "dealClosedAt" TIMESTAMP(3);
ALTER TABLE "lead" ADD COLUMN "dealOutcomeReason" TEXT;
ALTER TABLE "lead" ADD COLUMN "dealOutcomeNotes" TEXT;

CREATE TABLE "lead_stage_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "fromStageLabel" TEXT,
    "toStageLabel" TEXT,
    "dealValue" DECIMAL(12,2),
    "source" TEXT NOT NULL DEFAULT 'app',
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_stage_history_pkey" PRIMARY KEY ("id")
);

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "lead_stage_history_organizationId_createdAt_idx" ON "lead_stage_history"("organizationId", "createdAt");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "lead_stage_history_leadId_createdAt_idx" ON "lead_stage_history"("leadId", "createdAt");

ALTER TABLE "lead_stage_history"
    ADD CONSTRAINT "lead_stage_history_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_stage_history"
    ADD CONSTRAINT "lead_stage_history_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "deal_signal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "nextStep" TEXT,
    "nextStepSecured" BOOLEAN NOT NULL DEFAULT false,
    "nextStepChannel" TEXT,
    "nextStepDueAt" TIMESTAMP(3),
    "nextStepScore" INTEGER,
    "championScore" INTEGER,
    "championName" TEXT,
    "engagementScore" INTEGER,
    "qualityScore" INTEGER,
    "sentiment" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_signal_pkey" PRIMARY KEY ("id")
);

-- One signal per touchpoint per lead; re-analysis upserts.
-- @allow-non-concurrent-index: table is empty at creation
CREATE UNIQUE INDEX "deal_signal_organizationId_source_sourceId_leadId_key" ON "deal_signal"("organizationId", "source", "sourceId", "leadId");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "deal_signal_organizationId_occurredAt_idx" ON "deal_signal"("organizationId", "occurredAt");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "deal_signal_leadId_occurredAt_idx" ON "deal_signal"("leadId", "occurredAt");

ALTER TABLE "deal_signal"
    ADD CONSTRAINT "deal_signal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_signal"
    ADD CONSTRAINT "deal_signal_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security, matching the other org-scoped tables. History is
-- append-only from the client's point of view.
ALTER TABLE "lead_stage_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_stage_history_select" ON "lead_stage_history" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_stage_history_insert" ON "lead_stage_history" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_stage_history_update" ON "lead_stage_history" FOR UPDATE TO authenticated USING (false);
CREATE POLICY "lead_stage_history_delete" ON "lead_stage_history" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_stage_history_anon"   ON "lead_stage_history" FOR ALL TO anon USING (false);

ALTER TABLE "deal_signal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_signal_select" ON "deal_signal" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "deal_signal_insert" ON "deal_signal" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "deal_signal_update" ON "deal_signal" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "deal_signal_delete" ON "deal_signal" FOR DELETE TO authenticated USING (false);
CREATE POLICY "deal_signal_anon"   ON "deal_signal" FOR ALL TO anon USING (false);
