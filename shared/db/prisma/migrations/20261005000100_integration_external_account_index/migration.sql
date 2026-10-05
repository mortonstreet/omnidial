-- Webhook routing: find the org for a HubSpot portal id.
--
-- Single statement so Prisma runs it outside a transaction, which
-- CREATE INDEX CONCURRENTLY requires.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

CREATE INDEX CONCURRENTLY IF NOT EXISTS "integration_provider_externalAccountId_idx"
  ON "integration"("provider", "externalAccountId");
