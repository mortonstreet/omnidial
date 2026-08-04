-- ============================================
-- RLS classification for post-baseline tables
-- ============================================
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true
-- Table classifications:
--   enrichment_cache       => no-rls (platform-level cache, backend-only)
--   webhook_event_receipt  => no-rls (global webhook dedupe log, backend-only)
--
-- no-rls policy: enable RLS with zero policies so Supabase Data API denies access.

ALTER TABLE "enrichment_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_event_receipt" ENABLE ROW LEVEL SECURITY;
