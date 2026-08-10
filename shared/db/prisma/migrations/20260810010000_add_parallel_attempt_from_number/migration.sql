-- Track the caller ID used by each parallel dial attempt so user-level
-- caller-ID rotation can avoid assigning a number that is already active in a
-- parallel batch.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

ALTER TABLE "parallel_dial_attempt"
  ADD COLUMN "fromNumber" TEXT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "parallel_dial_attempt_fromNumber_idx"
  ON "parallel_dial_attempt"("fromNumber");
