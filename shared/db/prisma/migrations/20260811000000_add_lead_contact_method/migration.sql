-- Additional ways to reach a lead: office line, mobile, secondary email.
--
-- lead.email / lead.phone stay the primary values every existing caller reads.
-- Those primaries are mirrored into this table (isPrimary = true) so dedupe and
-- search match against one place rather than unioning a column with a table.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

CREATE TABLE "lead_contact_method" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_contact_method_pkey" PRIMARY KEY ("id")
);

-- One row per distinct value per lead: re-adding the same number is an update,
-- not a duplicate. Nulls never collide, so unnormalisable junk is still stored.
-- @allow-non-concurrent-index: table is empty at creation
CREATE UNIQUE INDEX "lead_contact_method_leadId_kind_normalizedValue_key"
    ON "lead_contact_method"("leadId", "kind", "normalizedValue");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "lead_contact_method_organizationId_idx"
    ON "lead_contact_method"("organizationId");

-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "lead_contact_method_leadId_idx"
    ON "lead_contact_method"("leadId");

-- Drives dedupe and search lookups by email/phone.
-- @allow-non-concurrent-index: table is empty at creation
CREATE INDEX "lead_contact_method_organizationId_kind_normalizedValue_idx"
    ON "lead_contact_method"("organizationId", "kind", "normalizedValue");

ALTER TABLE "lead_contact_method"
    ADD CONSTRAINT "lead_contact_method_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_contact_method"
    ADD CONSTRAINT "lead_contact_method_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the existing primaries so every lookup can go through this table.
-- normalizedPhone is already E.164 where it could be derived; fall back to the
-- raw phone so a row still exists for display.
INSERT INTO "lead_contact_method"
    ("id", "organizationId", "leadId", "kind", "label", "value", "normalizedValue", "isPrimary", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    l."organizationId",
    l."id",
    'email',
    'primary',
    l."email",
    lower(btrim(l."email")),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "lead" l
WHERE l."email" IS NOT NULL
  AND btrim(l."email") <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "lead_contact_method"
    ("id", "organizationId", "leadId", "kind", "label", "value", "normalizedValue", "isPrimary", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    l."organizationId",
    l."id",
    'phone',
    'primary',
    l."phone",
    COALESCE(l."normalizedPhone", l."phone"),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "lead" l
WHERE l."phone" IS NOT NULL
  AND btrim(l."phone") <> ''
ON CONFLICT DO NOTHING;

-- Row level security, matching the lead policies this table hangs off.
ALTER TABLE "lead_contact_method" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_contact_method_select" ON "lead_contact_method" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_contact_method_insert" ON "lead_contact_method" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_contact_method_update" ON "lead_contact_method" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
-- Deletes go through the service role, matching every other org-scoped table.
CREATE POLICY "lead_contact_method_delete" ON "lead_contact_method" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_contact_method_anon"   ON "lead_contact_method" FOR ALL TO anon USING (false);
