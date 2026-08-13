-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: false

-- Campaign-wide power dialer sessions (no list selected) store the sentinel
-- 'campaign-all' in power_dialer_progress."listId". That value is not a real
-- lead_list row, so the foreign key rejected every insert and upsert, which
-- made campaign-wide dialing fail with a 500 on every request.
--
-- The column stays NOT NULL and keeps holding either a real lead_list id or
-- the sentinel; only referential enforcement is dropped. Rows orphaned by a
-- deleted list are per-user scratch state and are cleaned up below.

ALTER TABLE "power_dialer_progress"
  DROP CONSTRAINT IF EXISTS "power_dialer_progress_listId_fkey";

-- Previously the FK cascaded deletes from lead_list. Without it, drop any
-- progress rows whose list no longer exists so stale sessions do not linger.
DELETE FROM "power_dialer_progress" p
WHERE p."listId" <> 'campaign-all'
  AND NOT EXISTS (
    SELECT 1 FROM "lead_list" l WHERE l."id" = p."listId"
  );
