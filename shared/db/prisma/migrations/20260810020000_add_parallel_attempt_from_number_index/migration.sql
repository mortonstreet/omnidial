-- Index for caller-ID rotation lookups on parallel dial attempts.
--
-- Deliberately the only statement in this migration: Prisma runs a
-- single-statement migration without opening a transaction, which is what lets
-- CREATE INDEX CONCURRENTLY succeed here (see the paired ALTER migration).
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

CREATE INDEX CONCURRENTLY IF NOT EXISTS "parallel_dial_attempt_fromNumber_idx"
  ON "parallel_dial_attempt"("fromNumber");
