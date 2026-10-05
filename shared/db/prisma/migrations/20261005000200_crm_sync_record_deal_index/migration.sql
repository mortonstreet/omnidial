-- Webhook routing: find the lead for a HubSpot deal id.
--
-- Single statement so Prisma runs it outside a transaction, which
-- CREATE INDEX CONCURRENTLY requires.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

CREATE INDEX CONCURRENTLY IF NOT EXISTS "crm_sync_record_provider_externalDealId_idx"
  ON "crm_sync_record"("provider", "externalDealId");
