-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true
-- Speeds up lead dedupe reference reassignment from duplicate leads to the survivor.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "campaign_lead_leadId_idx" ON "campaign_lead"("leadId");
