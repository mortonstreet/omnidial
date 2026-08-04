-- Add normalizedPhone column for E.164 formatted phone numbers
ALTER TABLE "lead" ADD COLUMN "normalizedPhone" TEXT;

-- Create partial unique index on (organizationId, normalizedPhone)
-- Only applies to non-deleted leads (where deletedAt IS NULL)
-- This allows duplicates among deleted leads but prevents duplicates among active leads
CREATE UNIQUE INDEX "lead_organizationId_normalizedPhone_unique"
ON "lead"("organizationId", "normalizedPhone")
WHERE "normalizedPhone" IS NOT NULL AND "deletedAt" IS NULL;

-- Create index for searching by normalized phone
CREATE INDEX "lead_organizationId_normalizedPhone_idx" ON "lead"("organizationId", "normalizedPhone");
