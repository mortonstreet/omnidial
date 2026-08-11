-- Track the caller ID used by each parallel dial attempt so user-level
-- caller-ID rotation can avoid assigning a number that is already active in a
-- parallel batch.
--
-- The matching index lives in its own migration: Prisma wraps a multi-statement
-- migration in a transaction, and CREATE INDEX CONCURRENTLY cannot run inside
-- one (Postgres 25001). Keeping this file to a single ALTER keeps both safe.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

ALTER TABLE "parallel_dial_attempt"
  ADD COLUMN "fromNumber" TEXT;
