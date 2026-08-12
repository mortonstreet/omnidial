-- Numbers this organisation must never dial again.
--
-- Keyed on the normalised number rather than the lead: a CSV re-import that
-- recreates the same person as a fresh lead stays suppressed, and unmerged
-- duplicates are covered by the single entry.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

CREATE TABLE "dnc_entry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "leadId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dnc_entry_pkey" PRIMARY KEY ("id")
);

-- One entry per number per org; marking twice is a no-op rather than an error.
-- @allow-non-concurrent-index: table is empty at creation
CREATE UNIQUE INDEX "dnc_entry_organizationId_normalizedPhone_key"
    ON "dnc_entry"("organizationId", "normalizedPhone");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "dnc_entry_organizationId_idx" ON "dnc_entry"("organizationId");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "dnc_entry_leadId_idx" ON "dnc_entry"("leadId");

ALTER TABLE "dnc_entry"
    ADD CONSTRAINT "dnc_entry_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The suppression must outlive the lead it came from, so this nulls rather
-- than cascades.
ALTER TABLE "dnc_entry"
    ADD CONSTRAINT "dnc_entry_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dnc_entry"
    ADD CONSTRAINT "dnc_entry_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Row level security, matching the other org-scoped tables.
ALTER TABLE "dnc_entry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dnc_entry_select" ON "dnc_entry" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "dnc_entry_insert" ON "dnc_entry" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "dnc_entry_update" ON "dnc_entry" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "dnc_entry_delete" ON "dnc_entry" FOR DELETE TO authenticated USING (false);
CREATE POLICY "dnc_entry_anon"   ON "dnc_entry" FOR ALL TO anon USING (false);
