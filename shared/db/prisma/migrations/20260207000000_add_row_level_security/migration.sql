-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Defense-in-depth: enforce org-level tenant isolation on the Supabase Data API.
-- The backend connects as `postgres` (superuser) which bypasses all RLS.
-- These policies only affect anon/authenticated roles hitting the Data API.
--
-- Policy patterns:
--   1. Direct org-scoped — tables with organizationId column
--   2. Nullable org-scoped — organizationId is nullable (system + org records)
--   3. JOIN-based — inherit org from parent table
--   4. User-scoped — filtered by userId
--   No RLS — auth tables managed by BetterAuth / admin-only tables
--
-- Every tenant table also gets:
--   - DELETE blocked (USING false) — enforce "never hard delete" rule
--   - anon blocked (USING false) — no anonymous access

-- ============================================
-- Helper Functions
-- ============================================

-- Extract org_id from Supabase JWT claims
CREATE OR REPLACE FUNCTION requesting_org_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'org_id',
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'org_id'
  );
$$ LANGUAGE sql STABLE;

-- Extract user ID from Supabase JWT
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.uid()::text,
    current_setting('request.jwt.claims', true)::json->>'sub'
  );
$$ LANGUAGE sql STABLE;


-- ============================================
-- Pattern 1: Direct org-scoped tables (have organizationId column)
-- 54 tables × 5 policies each
-- ============================================

-- ---------- client ----------
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_select" ON "client" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "client_insert" ON "client" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_update" ON "client" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_delete" ON "client" FOR DELETE TO authenticated USING (false);
CREATE POLICY "client_anon"   ON "client" FOR ALL TO anon USING (false);

-- ---------- client_user_assignment ----------
ALTER TABLE "client_user_assignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_user_assignment_select" ON "client_user_assignment" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "client_user_assignment_insert" ON "client_user_assignment" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_user_assignment_update" ON "client_user_assignment" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_user_assignment_delete" ON "client_user_assignment" FOR DELETE TO authenticated USING (false);
CREATE POLICY "client_user_assignment_anon"   ON "client_user_assignment" FOR ALL TO anon USING (false);

-- ---------- client_phone_number ----------
ALTER TABLE "client_phone_number" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_phone_number_select" ON "client_phone_number" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "client_phone_number_insert" ON "client_phone_number" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_phone_number_update" ON "client_phone_number" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "client_phone_number_delete" ON "client_phone_number" FOR DELETE TO authenticated USING (false);
CREATE POLICY "client_phone_number_anon"   ON "client_phone_number" FOR ALL TO anon USING (false);

-- ---------- member ----------
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_select" ON "member" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "member_insert" ON "member" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "member_update" ON "member" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "member_delete" ON "member" FOR DELETE TO authenticated USING (false);
CREATE POLICY "member_anon"   ON "member" FOR ALL TO anon USING (false);

-- ---------- invitation ----------
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitation_select" ON "invitation" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "invitation_insert" ON "invitation" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "invitation_update" ON "invitation" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "invitation_delete" ON "invitation" FOR DELETE TO authenticated USING (false);
CREATE POLICY "invitation_anon"   ON "invitation" FOR ALL TO anon USING (false);

-- ---------- credit_transaction ----------
ALTER TABLE "credit_transaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_transaction_select" ON "credit_transaction" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "credit_transaction_insert" ON "credit_transaction" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "credit_transaction_update" ON "credit_transaction" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "credit_transaction_delete" ON "credit_transaction" FOR DELETE TO authenticated USING (false);
CREATE POLICY "credit_transaction_anon"   ON "credit_transaction" FOR ALL TO anon USING (false);

-- ---------- campaign ----------
ALTER TABLE "campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_select" ON "campaign" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "campaign_insert" ON "campaign" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "campaign_update" ON "campaign" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "campaign_delete" ON "campaign" FOR DELETE TO authenticated USING (false);
CREATE POLICY "campaign_anon"   ON "campaign" FOR ALL TO anon USING (false);

-- ---------- lead ----------
ALTER TABLE "lead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_select" ON "lead" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_insert" ON "lead" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_update" ON "lead" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_delete" ON "lead" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_anon"   ON "lead" FOR ALL TO anon USING (false);

-- ---------- pipeline_stage ----------
ALTER TABLE "pipeline_stage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stage_select" ON "pipeline_stage" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "pipeline_stage_insert" ON "pipeline_stage" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "pipeline_stage_update" ON "pipeline_stage" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "pipeline_stage_delete" ON "pipeline_stage" FOR DELETE TO authenticated USING (false);
CREATE POLICY "pipeline_stage_anon"   ON "pipeline_stage" FOR ALL TO anon USING (false);

-- ---------- task ----------
ALTER TABLE "task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_select" ON "task" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "task_insert" ON "task" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "task_update" ON "task" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "task_delete" ON "task" FOR DELETE TO authenticated USING (false);
CREATE POLICY "task_anon"   ON "task" FOR ALL TO anon USING (false);

-- ---------- note ----------
ALTER TABLE "note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_select" ON "note" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "note_insert" ON "note" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "note_update" ON "note" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "note_delete" ON "note" FOR DELETE TO authenticated USING (false);
CREATE POLICY "note_anon"   ON "note" FOR ALL TO anon USING (false);

-- ---------- lead_list_folder ----------
ALTER TABLE "lead_list_folder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_list_folder_select" ON "lead_list_folder" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_folder_insert" ON "lead_list_folder" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_folder_update" ON "lead_list_folder" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_folder_delete" ON "lead_list_folder" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_list_folder_anon"   ON "lead_list_folder" FOR ALL TO anon USING (false);

-- ---------- lead_list ----------
ALTER TABLE "lead_list" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_list_select" ON "lead_list" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_insert" ON "lead_list" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_update" ON "lead_list" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_list_delete" ON "lead_list" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_list_anon"   ON "lead_list" FOR ALL TO anon USING (false);

-- ---------- twilio_config ----------
ALTER TABLE "twilio_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "twilio_config_select" ON "twilio_config" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "twilio_config_insert" ON "twilio_config" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "twilio_config_update" ON "twilio_config" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "twilio_config_delete" ON "twilio_config" FOR DELETE TO authenticated USING (false);
CREATE POLICY "twilio_config_anon"   ON "twilio_config" FOR ALL TO anon USING (false);

-- ---------- activity ----------
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON "activity" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "activity_insert" ON "activity" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "activity_update" ON "activity" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "activity_delete" ON "activity" FOR DELETE TO authenticated USING (false);
CREATE POLICY "activity_anon"   ON "activity" FOR ALL TO anon USING (false);

-- ---------- schedule_event ----------
ALTER TABLE "schedule_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_event_select" ON "schedule_event" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "schedule_event_insert" ON "schedule_event" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "schedule_event_update" ON "schedule_event" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "schedule_event_delete" ON "schedule_event" FOR DELETE TO authenticated USING (false);
CREATE POLICY "schedule_event_anon"   ON "schedule_event" FOR ALL TO anon USING (false);

-- ---------- script ----------
ALTER TABLE "script" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "script_select" ON "script" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "script_insert" ON "script" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "script_update" ON "script" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "script_delete" ON "script" FOR DELETE TO authenticated USING (false);
CREATE POLICY "script_anon"   ON "script" FOR ALL TO anon USING (false);

-- ---------- integration ----------
ALTER TABLE "integration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_select" ON "integration" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "integration_insert" ON "integration" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "integration_update" ON "integration" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "integration_delete" ON "integration" FOR DELETE TO authenticated USING (false);
CREATE POLICY "integration_anon"   ON "integration" FOR ALL TO anon USING (false);

-- ---------- api_key ----------
ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_key_select" ON "api_key" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "api_key_insert" ON "api_key" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "api_key_update" ON "api_key" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "api_key_delete" ON "api_key" FOR DELETE TO authenticated USING (false);
CREATE POLICY "api_key_anon"   ON "api_key" FOR ALL TO anon USING (false);

-- ---------- enrichengine_connection ----------
ALTER TABLE "enrichengine_connection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrichengine_connection_select" ON "enrichengine_connection" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "enrichengine_connection_insert" ON "enrichengine_connection" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "enrichengine_connection_update" ON "enrichengine_connection" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "enrichengine_connection_delete" ON "enrichengine_connection" FOR DELETE TO authenticated USING (false);
CREATE POLICY "enrichengine_connection_anon"   ON "enrichengine_connection" FOR ALL TO anon USING (false);

-- ---------- active_dialer_session ----------
ALTER TABLE "active_dialer_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active_dialer_session_select" ON "active_dialer_session" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "active_dialer_session_insert" ON "active_dialer_session" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "active_dialer_session_update" ON "active_dialer_session" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "active_dialer_session_delete" ON "active_dialer_session" FOR DELETE TO authenticated USING (false);
CREATE POLICY "active_dialer_session_anon"   ON "active_dialer_session" FOR ALL TO anon USING (false);

-- ---------- call_transcript ----------
ALTER TABLE "call_transcript" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_transcript_select" ON "call_transcript" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "call_transcript_insert" ON "call_transcript" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_transcript_update" ON "call_transcript" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_transcript_delete" ON "call_transcript" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_transcript_anon"   ON "call_transcript" FOR ALL TO anon USING (false);

-- ---------- call_coaching ----------
ALTER TABLE "call_coaching" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_coaching_select" ON "call_coaching" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "call_coaching_insert" ON "call_coaching" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_coaching_update" ON "call_coaching" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_coaching_delete" ON "call_coaching" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_coaching_anon"   ON "call_coaching" FOR ALL TO anon USING (false);

-- ---------- call_intelligence ----------
ALTER TABLE "call_intelligence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_intelligence_select" ON "call_intelligence" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "call_intelligence_insert" ON "call_intelligence" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_intelligence_update" ON "call_intelligence" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_intelligence_delete" ON "call_intelligence" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_intelligence_anon"   ON "call_intelligence" FOR ALL TO anon USING (false);

-- ---------- parallel_dial_session ----------
ALTER TABLE "parallel_dial_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parallel_dial_session_select" ON "parallel_dial_session" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "parallel_dial_session_insert" ON "parallel_dial_session" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "parallel_dial_session_update" ON "parallel_dial_session" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "parallel_dial_session_delete" ON "parallel_dial_session" FOR DELETE TO authenticated USING (false);
CREATE POLICY "parallel_dial_session_anon"   ON "parallel_dial_session" FOR ALL TO anon USING (false);

-- ---------- lead_predictive_score ----------
ALTER TABLE "lead_predictive_score" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_predictive_score_select" ON "lead_predictive_score" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_predictive_score_insert" ON "lead_predictive_score" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_predictive_score_update" ON "lead_predictive_score" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_predictive_score_delete" ON "lead_predictive_score" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_predictive_score_anon"   ON "lead_predictive_score" FOR ALL TO anon USING (false);

-- ---------- call_answer_pattern ----------
ALTER TABLE "call_answer_pattern" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_answer_pattern_select" ON "call_answer_pattern" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "call_answer_pattern_insert" ON "call_answer_pattern" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_answer_pattern_update" ON "call_answer_pattern" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_answer_pattern_delete" ON "call_answer_pattern" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_answer_pattern_anon"   ON "call_answer_pattern" FOR ALL TO anon USING (false);

-- ---------- call_blitz ----------
ALTER TABLE "call_blitz" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_blitz_select" ON "call_blitz" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "call_blitz_insert" ON "call_blitz" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_blitz_update" ON "call_blitz" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "call_blitz_delete" ON "call_blitz" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_blitz_anon"   ON "call_blitz" FOR ALL TO anon USING (false);

-- ---------- manager_listen_session ----------
ALTER TABLE "manager_listen_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_listen_session_select" ON "manager_listen_session" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "manager_listen_session_insert" ON "manager_listen_session" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "manager_listen_session_update" ON "manager_listen_session" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "manager_listen_session_delete" ON "manager_listen_session" FOR DELETE TO authenticated USING (false);
CREATE POLICY "manager_listen_session_anon"   ON "manager_listen_session" FOR ALL TO anon USING (false);

-- ---------- coach_card ----------
ALTER TABLE "coach_card" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_card_select" ON "coach_card" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "coach_card_insert" ON "coach_card" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "coach_card_update" ON "coach_card" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "coach_card_delete" ON "coach_card" FOR DELETE TO authenticated USING (false);
CREATE POLICY "coach_card_anon"   ON "coach_card" FOR ALL TO anon USING (false);

-- ---------- live_transcript_segment ----------
ALTER TABLE "live_transcript_segment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_transcript_segment_select" ON "live_transcript_segment" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "live_transcript_segment_insert" ON "live_transcript_segment" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "live_transcript_segment_update" ON "live_transcript_segment" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "live_transcript_segment_delete" ON "live_transcript_segment" FOR DELETE TO authenticated USING (false);
CREATE POLICY "live_transcript_segment_anon"   ON "live_transcript_segment" FOR ALL TO anon USING (false);

-- ---------- phone_number_pool ----------
ALTER TABLE "phone_number_pool" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_number_pool_select" ON "phone_number_pool" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "phone_number_pool_insert" ON "phone_number_pool" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "phone_number_pool_update" ON "phone_number_pool" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "phone_number_pool_delete" ON "phone_number_pool" FOR DELETE TO authenticated USING (false);
CREATE POLICY "phone_number_pool_anon"   ON "phone_number_pool" FOR ALL TO anon USING (false);

-- ---------- callback_route ----------
ALTER TABLE "callback_route" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "callback_route_select" ON "callback_route" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "callback_route_insert" ON "callback_route" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "callback_route_update" ON "callback_route" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "callback_route_delete" ON "callback_route" FOR DELETE TO authenticated USING (false);
CREATE POLICY "callback_route_anon"   ON "callback_route" FOR ALL TO anon USING (false);

-- ---------- data_vendor_connection ----------
ALTER TABLE "data_vendor_connection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_vendor_connection_select" ON "data_vendor_connection" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "data_vendor_connection_insert" ON "data_vendor_connection" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "data_vendor_connection_update" ON "data_vendor_connection" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "data_vendor_connection_delete" ON "data_vendor_connection" FOR DELETE TO authenticated USING (false);
CREATE POLICY "data_vendor_connection_anon"   ON "data_vendor_connection" FOR ALL TO anon USING (false);

-- ---------- enrichment_history ----------
ALTER TABLE "enrichment_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrichment_history_select" ON "enrichment_history" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "enrichment_history_insert" ON "enrichment_history" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "enrichment_history_update" ON "enrichment_history" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "enrichment_history_delete" ON "enrichment_history" FOR DELETE TO authenticated USING (false);
CREATE POLICY "enrichment_history_anon"   ON "enrichment_history" FOR ALL TO anon USING (false);

-- ---------- custom_field_schema ----------
ALTER TABLE "custom_field_schema" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_field_schema_select" ON "custom_field_schema" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "custom_field_schema_insert" ON "custom_field_schema" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "custom_field_schema_update" ON "custom_field_schema" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "custom_field_schema_delete" ON "custom_field_schema" FOR DELETE TO authenticated USING (false);
CREATE POLICY "custom_field_schema_anon"   ON "custom_field_schema" FOR ALL TO anon USING (false);

-- ---------- research_task ----------
ALTER TABLE "research_task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_task_select" ON "research_task" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "research_task_insert" ON "research_task" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "research_task_update" ON "research_task" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "research_task_delete" ON "research_task" FOR DELETE TO authenticated USING (false);
CREATE POLICY "research_task_anon"   ON "research_task" FOR ALL TO anon USING (false);

-- ---------- research_history ----------
ALTER TABLE "research_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_history_select" ON "research_history" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "research_history_insert" ON "research_history" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "research_history_update" ON "research_history" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "research_history_delete" ON "research_history" FOR DELETE TO authenticated USING (false);
CREATE POLICY "research_history_anon"   ON "research_history" FOR ALL TO anon USING (false);

-- ---------- lead_qualification ----------
ALTER TABLE "lead_qualification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_qualification_select" ON "lead_qualification" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "lead_qualification_insert" ON "lead_qualification" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_qualification_update" ON "lead_qualification" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "lead_qualification_delete" ON "lead_qualification" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_qualification_anon"   ON "lead_qualification" FOR ALL TO anon USING (false);

-- ---------- agent ----------
ALTER TABLE "agent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_select" ON "agent" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_insert" ON "agent" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_update" ON "agent" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_delete" ON "agent" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_anon"   ON "agent" FOR ALL TO anon USING (false);

-- ---------- agent_instance ----------
ALTER TABLE "agent_instance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_instance_select" ON "agent_instance" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_instance_insert" ON "agent_instance" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_instance_update" ON "agent_instance" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_instance_delete" ON "agent_instance" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_instance_anon"   ON "agent_instance" FOR ALL TO anon USING (false);

-- ---------- agent_session ----------
ALTER TABLE "agent_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_session_select" ON "agent_session" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_session_insert" ON "agent_session" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_session_update" ON "agent_session" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_session_delete" ON "agent_session" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_session_anon"   ON "agent_session" FOR ALL TO anon USING (false);

-- ---------- agent_memory ----------
ALTER TABLE "agent_memory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_memory_select" ON "agent_memory" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_memory_insert" ON "agent_memory" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_memory_update" ON "agent_memory" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_memory_delete" ON "agent_memory" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_memory_anon"   ON "agent_memory" FOR ALL TO anon USING (false);

-- ---------- agent_tool_call ----------
ALTER TABLE "agent_tool_call" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_tool_call_select" ON "agent_tool_call" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_tool_call_insert" ON "agent_tool_call" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_tool_call_update" ON "agent_tool_call" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_tool_call_delete" ON "agent_tool_call" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_tool_call_anon"   ON "agent_tool_call" FOR ALL TO anon USING (false);

-- ---------- sms_campaign ----------
ALTER TABLE "sms_campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_campaign_select" ON "sms_campaign" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "sms_campaign_insert" ON "sms_campaign" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "sms_campaign_update" ON "sms_campaign" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "sms_campaign_delete" ON "sms_campaign" FOR DELETE TO authenticated USING (false);
CREATE POLICY "sms_campaign_anon"   ON "sms_campaign" FOR ALL TO anon USING (false);

-- ---------- orchestration_job ----------
ALTER TABLE "orchestration_job" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orchestration_job_select" ON "orchestration_job" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "orchestration_job_insert" ON "orchestration_job" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "orchestration_job_update" ON "orchestration_job" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "orchestration_job_delete" ON "orchestration_job" FOR DELETE TO authenticated USING (false);
CREATE POLICY "orchestration_job_anon"   ON "orchestration_job" FOR ALL TO anon USING (false);

-- ---------- clawdbody_instance ----------
ALTER TABLE "clawdbody_instance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clawdbody_instance_select" ON "clawdbody_instance" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "clawdbody_instance_insert" ON "clawdbody_instance" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "clawdbody_instance_update" ON "clawdbody_instance" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "clawdbody_instance_delete" ON "clawdbody_instance" FOR DELETE TO authenticated USING (false);
CREATE POLICY "clawdbody_instance_anon"   ON "clawdbody_instance" FOR ALL TO anon USING (false);

-- ---------- agent_definition ----------
ALTER TABLE "agent_definition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_definition_select" ON "agent_definition" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_definition_insert" ON "agent_definition" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_definition_update" ON "agent_definition" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_definition_delete" ON "agent_definition" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_definition_anon"   ON "agent_definition" FOR ALL TO anon USING (false);

-- ---------- agent_execution ----------
ALTER TABLE "agent_execution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_execution_select" ON "agent_execution" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_execution_insert" ON "agent_execution" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_execution_update" ON "agent_execution" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_execution_delete" ON "agent_execution" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_execution_anon"   ON "agent_execution" FOR ALL TO anon USING (false);

-- ---------- agent_approval ----------
ALTER TABLE "agent_approval" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_approval_select" ON "agent_approval" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_approval_insert" ON "agent_approval" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_approval_update" ON "agent_approval" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_approval_delete" ON "agent_approval" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_approval_anon"   ON "agent_approval" FOR ALL TO anon USING (false);

-- ---------- agent_usage ----------
ALTER TABLE "agent_usage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_usage_select" ON "agent_usage" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "agent_usage_insert" ON "agent_usage" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_usage_update" ON "agent_usage" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "agent_usage_delete" ON "agent_usage" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_usage_anon"   ON "agent_usage" FOR ALL TO anon USING (false);

-- ---------- phone_provisioning ----------
ALTER TABLE "phone_provisioning" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_provisioning_select" ON "phone_provisioning" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "phone_provisioning_insert" ON "phone_provisioning" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "phone_provisioning_update" ON "phone_provisioning" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "phone_provisioning_delete" ON "phone_provisioning" FOR DELETE TO authenticated USING (false);
CREATE POLICY "phone_provisioning_anon"   ON "phone_provisioning" FOR ALL TO anon USING (false);

-- ---------- crm_sync_record ----------
ALTER TABLE "crm_sync_record" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sync_record_select" ON "crm_sync_record" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "crm_sync_record_insert" ON "crm_sync_record" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "crm_sync_record_update" ON "crm_sync_record" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "crm_sync_record_delete" ON "crm_sync_record" FOR DELETE TO authenticated USING (false);
CREATE POLICY "crm_sync_record_anon"   ON "crm_sync_record" FOR ALL TO anon USING (false);

-- ---------- usage_cycle ----------
ALTER TABLE "usage_cycle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_cycle_select" ON "usage_cycle" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "usage_cycle_insert" ON "usage_cycle" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "usage_cycle_update" ON "usage_cycle" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "usage_cycle_delete" ON "usage_cycle" FOR DELETE TO authenticated USING (false);
CREATE POLICY "usage_cycle_anon"   ON "usage_cycle" FOR ALL TO anon USING (false);

-- ---------- billing_event ----------
ALTER TABLE "billing_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_event_select" ON "billing_event" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "billing_event_insert" ON "billing_event" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "billing_event_update" ON "billing_event" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "billing_event_delete" ON "billing_event" FOR DELETE TO authenticated USING (false);
CREATE POLICY "billing_event_anon"   ON "billing_event" FOR ALL TO anon USING (false);

-- ---------- a2p_brand_registration ----------
ALTER TABLE "a2p_brand_registration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "a2p_brand_registration_select" ON "a2p_brand_registration" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "a2p_brand_registration_insert" ON "a2p_brand_registration" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "a2p_brand_registration_update" ON "a2p_brand_registration" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "a2p_brand_registration_delete" ON "a2p_brand_registration" FOR DELETE TO authenticated USING (false);
CREATE POLICY "a2p_brand_registration_anon"   ON "a2p_brand_registration" FOR ALL TO anon USING (false);


-- ============================================
-- Pattern 2: Nullable org-scoped tables
-- organizationId is nullable — SELECT allows NULL (system records) + matching org
-- ============================================

-- ---------- slack_workspace ----------
ALTER TABLE "slack_workspace" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_workspace_select" ON "slack_workspace" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "slack_workspace_insert" ON "slack_workspace" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "slack_workspace_update" ON "slack_workspace" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL) WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "slack_workspace_delete" ON "slack_workspace" FOR DELETE TO authenticated USING (false);
CREATE POLICY "slack_workspace_anon"   ON "slack_workspace" FOR ALL TO anon USING (false);

-- ---------- research_template ----------
ALTER TABLE "research_template" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_template_select" ON "research_template" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "research_template_insert" ON "research_template" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "research_template_update" ON "research_template" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL) WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "research_template_delete" ON "research_template" FOR DELETE TO authenticated USING (false);
CREATE POLICY "research_template_anon"   ON "research_template" FOR ALL TO anon USING (false);

-- ---------- error_log ----------
ALTER TABLE "error_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_log_select" ON "error_log" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "error_log_insert" ON "error_log" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "error_log_update" ON "error_log" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL) WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "error_log_delete" ON "error_log" FOR DELETE TO authenticated USING (false);
CREATE POLICY "error_log_anon"   ON "error_log" FOR ALL TO anon USING (false);

-- ---------- agent_tool ----------
ALTER TABLE "agent_tool" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_tool_select" ON "agent_tool" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "agent_tool_insert" ON "agent_tool" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "agent_tool_update" ON "agent_tool" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id() OR "organizationId" IS NULL) WITH CHECK ("organizationId" = requesting_org_id() OR "organizationId" IS NULL);
CREATE POLICY "agent_tool_delete" ON "agent_tool" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_tool_anon"   ON "agent_tool" FOR ALL TO anon USING (false);


-- ============================================
-- Pattern 3: JOIN-based org isolation
-- Tables without organizationId — inherit org from parent via FK
-- ============================================

-- ---------- campaign_lead (via campaign.organizationId) ----------
ALTER TABLE "campaign_lead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_lead_select" ON "campaign_lead" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_lead"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_lead_insert" ON "campaign_lead" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_lead"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_lead_update" ON "campaign_lead" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_lead"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_lead_delete" ON "campaign_lead" FOR DELETE TO authenticated USING (false);
CREATE POLICY "campaign_lead_anon"   ON "campaign_lead" FOR ALL TO anon USING (false);

-- ---------- campaign_user (via campaign.organizationId) ----------
ALTER TABLE "campaign_user" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_user_select" ON "campaign_user" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_user"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_user_insert" ON "campaign_user" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_user"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_user_update" ON "campaign_user" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_user"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_user_delete" ON "campaign_user" FOR DELETE TO authenticated USING (false);
CREATE POLICY "campaign_user_anon"   ON "campaign_user" FOR ALL TO anon USING (false);

-- ---------- campaign_list (via campaign.organizationId) ----------
ALTER TABLE "campaign_list" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_list_select" ON "campaign_list" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_list"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_list_insert" ON "campaign_list" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_list"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_list_update" ON "campaign_list" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "campaign_list"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "campaign_list_delete" ON "campaign_list" FOR DELETE TO authenticated USING (false);
CREATE POLICY "campaign_list_anon"   ON "campaign_list" FOR ALL TO anon USING (false);

-- ---------- power_dialer_progress (via campaign.organizationId) ----------
ALTER TABLE "power_dialer_progress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "power_dialer_progress_select" ON "power_dialer_progress" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "power_dialer_progress"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "power_dialer_progress_insert" ON "power_dialer_progress" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "power_dialer_progress"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "power_dialer_progress_update" ON "power_dialer_progress" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "campaign" WHERE "campaign"."id" = "power_dialer_progress"."campaignId" AND "campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "power_dialer_progress_delete" ON "power_dialer_progress" FOR DELETE TO authenticated USING (false);
CREATE POLICY "power_dialer_progress_anon"   ON "power_dialer_progress" FOR ALL TO anon USING (false);

-- ---------- call (via twilio_config.organizationId) ----------
ALTER TABLE "call" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_select" ON "call" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "call"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "call_insert" ON "call" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "call"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "call_update" ON "call" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "call"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "call_delete" ON "call" FOR DELETE TO authenticated USING (false);
CREATE POLICY "call_anon"   ON "call" FOR ALL TO anon USING (false);

-- ---------- voicemail_greeting (via twilio_config.organizationId) ----------
ALTER TABLE "voicemail_greeting" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voicemail_greeting_select" ON "voicemail_greeting" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_greeting"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_greeting_insert" ON "voicemail_greeting" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_greeting"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_greeting_update" ON "voicemail_greeting" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_greeting"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_greeting_delete" ON "voicemail_greeting" FOR DELETE TO authenticated USING (false);
CREATE POLICY "voicemail_greeting_anon"   ON "voicemail_greeting" FOR ALL TO anon USING (false);

-- ---------- voicemail_drop (via twilio_config.organizationId) ----------
ALTER TABLE "voicemail_drop" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voicemail_drop_select" ON "voicemail_drop" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_drop"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_drop_insert" ON "voicemail_drop" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_drop"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_drop_update" ON "voicemail_drop" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "voicemail_drop"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "voicemail_drop_delete" ON "voicemail_drop" FOR DELETE TO authenticated USING (false);
CREATE POLICY "voicemail_drop_anon"   ON "voicemail_drop" FOR ALL TO anon USING (false);

-- ---------- disposition (via twilio_config.organizationId) ----------
ALTER TABLE "disposition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disposition_select" ON "disposition" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "disposition"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "disposition_insert" ON "disposition" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "disposition"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "disposition_update" ON "disposition" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "twilio_config" WHERE "twilio_config"."id" = "disposition"."twilioConfigId" AND "twilio_config"."organizationId" = requesting_org_id()));
CREATE POLICY "disposition_delete" ON "disposition" FOR DELETE TO authenticated USING (false);
CREATE POLICY "disposition_anon"   ON "disposition" FOR ALL TO anon USING (false);

-- ---------- lead_list_entry (via lead_list.organizationId) ----------
ALTER TABLE "lead_list_entry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_list_entry_select" ON "lead_list_entry" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "lead_list" WHERE "lead_list"."id" = "lead_list_entry"."listId" AND "lead_list"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_list_entry_insert" ON "lead_list_entry" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "lead_list" WHERE "lead_list"."id" = "lead_list_entry"."listId" AND "lead_list"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_list_entry_update" ON "lead_list_entry" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "lead_list" WHERE "lead_list"."id" = "lead_list_entry"."listId" AND "lead_list"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_list_entry_delete" ON "lead_list_entry" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_list_entry_anon"   ON "lead_list_entry" FOR ALL TO anon USING (false);

-- ---------- sms_campaign_list (via sms_campaign.organizationId) ----------
ALTER TABLE "sms_campaign_list" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_campaign_list_select" ON "sms_campaign_list" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_list"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_list_insert" ON "sms_campaign_list" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_list"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_list_update" ON "sms_campaign_list" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_list"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_list_delete" ON "sms_campaign_list" FOR DELETE TO authenticated USING (false);
CREATE POLICY "sms_campaign_list_anon"   ON "sms_campaign_list" FOR ALL TO anon USING (false);

-- ---------- sms_campaign_enrollment (via sms_campaign.organizationId) ----------
ALTER TABLE "sms_campaign_enrollment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_campaign_enrollment_select" ON "sms_campaign_enrollment" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_enrollment"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_enrollment_insert" ON "sms_campaign_enrollment" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_enrollment"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_enrollment_update" ON "sms_campaign_enrollment" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_enrollment"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_enrollment_delete" ON "sms_campaign_enrollment" FOR DELETE TO authenticated USING (false);
CREATE POLICY "sms_campaign_enrollment_anon"   ON "sms_campaign_enrollment" FOR ALL TO anon USING (false);

-- ---------- sms_campaign_message (via sms_campaign.organizationId) ----------
ALTER TABLE "sms_campaign_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_campaign_message_select" ON "sms_campaign_message" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_message"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_message_insert" ON "sms_campaign_message" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_message"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_message_update" ON "sms_campaign_message" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_message"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_message_delete" ON "sms_campaign_message" FOR DELETE TO authenticated USING (false);
CREATE POLICY "sms_campaign_message_anon"   ON "sms_campaign_message" FOR ALL TO anon USING (false);

-- ---------- sms_campaign_step (via sms_campaign.organizationId) ----------
ALTER TABLE "sms_campaign_step" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_campaign_step_select" ON "sms_campaign_step" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_step"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_step_insert" ON "sms_campaign_step" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_step"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_step_update" ON "sms_campaign_step" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "sms_campaign" WHERE "sms_campaign"."id" = "sms_campaign_step"."campaignId" AND "sms_campaign"."organizationId" = requesting_org_id()));
CREATE POLICY "sms_campaign_step_delete" ON "sms_campaign_step" FOR DELETE TO authenticated USING (false);
CREATE POLICY "sms_campaign_step_anon"   ON "sms_campaign_step" FOR ALL TO anon USING (false);

-- ---------- agent_workflow (via agent.organizationId) ----------
ALTER TABLE "agent_workflow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_workflow_select" ON "agent_workflow" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_workflow"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_workflow_insert" ON "agent_workflow" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_workflow"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_workflow_update" ON "agent_workflow" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_workflow"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_workflow_delete" ON "agent_workflow" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_workflow_anon"   ON "agent_workflow" FOR ALL TO anon USING (false);

-- ---------- agent_message (via agent.organizationId) ----------
ALTER TABLE "agent_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_message_select" ON "agent_message" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_message"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_message_insert" ON "agent_message" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_message"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_message_update" ON "agent_message" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_message"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_message_delete" ON "agent_message" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_message_anon"   ON "agent_message" FOR ALL TO anon USING (false);

-- ---------- agent_email_config (via agent.organizationId) ----------
ALTER TABLE "agent_email_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_email_config_select" ON "agent_email_config" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_email_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_email_config_insert" ON "agent_email_config" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_email_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_email_config_update" ON "agent_email_config" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_email_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_email_config_delete" ON "agent_email_config" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_email_config_anon"   ON "agent_email_config" FOR ALL TO anon USING (false);

-- ---------- agent_sms_config (via agent.organizationId) ----------
ALTER TABLE "agent_sms_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_sms_config_select" ON "agent_sms_config" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_sms_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_sms_config_insert" ON "agent_sms_config" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_sms_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_sms_config_update" ON "agent_sms_config" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent" WHERE "agent"."id" = "agent_sms_config"."agentId" AND "agent"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_sms_config_delete" ON "agent_sms_config" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_sms_config_anon"   ON "agent_sms_config" FOR ALL TO anon USING (false);

-- ---------- slack_user_link (via slack_workspace → organizationId) ----------
ALTER TABLE "slack_user_link" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_user_link_select" ON "slack_user_link" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_user_link"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_user_link_insert" ON "slack_user_link" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_user_link"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_user_link_update" ON "slack_user_link" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_user_link"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_user_link_delete" ON "slack_user_link" FOR DELETE TO authenticated USING (false);
CREATE POLICY "slack_user_link_anon"   ON "slack_user_link" FOR ALL TO anon USING (false);

-- ---------- slack_notification_rule (via slack_workspace → organizationId) ----------
ALTER TABLE "slack_notification_rule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_notification_rule_select" ON "slack_notification_rule" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_notification_rule"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_notification_rule_insert" ON "slack_notification_rule" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_notification_rule"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_notification_rule_update" ON "slack_notification_rule" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_notification_rule"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_notification_rule_delete" ON "slack_notification_rule" FOR DELETE TO authenticated USING (false);
CREATE POLICY "slack_notification_rule_anon"   ON "slack_notification_rule" FOR ALL TO anon USING (false);

-- ---------- slack_message_log (via slack_workspace → organizationId) ----------
ALTER TABLE "slack_message_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_message_log_select" ON "slack_message_log" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_message_log"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_message_log_insert" ON "slack_message_log" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_message_log"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_message_log_update" ON "slack_message_log" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_message_log"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_message_log_delete" ON "slack_message_log" FOR DELETE TO authenticated USING (false);
CREATE POLICY "slack_message_log_anon"   ON "slack_message_log" FOR ALL TO anon USING (false);

-- ---------- slack_link_token (via slack_workspace → organizationId) ----------
ALTER TABLE "slack_link_token" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_link_token_select" ON "slack_link_token" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_link_token"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_link_token_insert" ON "slack_link_token" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_link_token"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_link_token_update" ON "slack_link_token" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "slack_workspace" WHERE "slack_workspace"."id" = "slack_link_token"."workspaceId" AND ("slack_workspace"."organizationId" = requesting_org_id() OR "slack_workspace"."organizationId" IS NULL)));
CREATE POLICY "slack_link_token_delete" ON "slack_link_token" FOR DELETE TO authenticated USING (false);
CREATE POLICY "slack_link_token_anon"   ON "slack_link_token" FOR ALL TO anon USING (false);

-- ---------- parallel_dial_attempt (via parallel_dial_session.organizationId) ----------
ALTER TABLE "parallel_dial_attempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parallel_dial_attempt_select" ON "parallel_dial_attempt" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "parallel_dial_session" WHERE "parallel_dial_session"."id" = "parallel_dial_attempt"."sessionId" AND "parallel_dial_session"."organizationId" = requesting_org_id()));
CREATE POLICY "parallel_dial_attempt_insert" ON "parallel_dial_attempt" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "parallel_dial_session" WHERE "parallel_dial_session"."id" = "parallel_dial_attempt"."sessionId" AND "parallel_dial_session"."organizationId" = requesting_org_id()));
CREATE POLICY "parallel_dial_attempt_update" ON "parallel_dial_attempt" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "parallel_dial_session" WHERE "parallel_dial_session"."id" = "parallel_dial_attempt"."sessionId" AND "parallel_dial_session"."organizationId" = requesting_org_id()));
CREATE POLICY "parallel_dial_attempt_delete" ON "parallel_dial_attempt" FOR DELETE TO authenticated USING (false);
CREATE POLICY "parallel_dial_attempt_anon"   ON "parallel_dial_attempt" FOR ALL TO anon USING (false);

-- ---------- api_key_usage (via api_key.organizationId) ----------
ALTER TABLE "api_key_usage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_key_usage_select" ON "api_key_usage" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "api_key" WHERE "api_key"."id" = "api_key_usage"."apiKeyId" AND "api_key"."organizationId" = requesting_org_id()));
CREATE POLICY "api_key_usage_insert" ON "api_key_usage" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "api_key" WHERE "api_key"."id" = "api_key_usage"."apiKeyId" AND "api_key"."organizationId" = requesting_org_id()));
CREATE POLICY "api_key_usage_update" ON "api_key_usage" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "api_key" WHERE "api_key"."id" = "api_key_usage"."apiKeyId" AND "api_key"."organizationId" = requesting_org_id()));
CREATE POLICY "api_key_usage_delete" ON "api_key_usage" FOR DELETE TO authenticated USING (false);
CREATE POLICY "api_key_usage_anon"   ON "api_key_usage" FOR ALL TO anon USING (false);

-- ---------- blitz_participant (via call_blitz.organizationId) ----------
ALTER TABLE "blitz_participant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blitz_participant_select" ON "blitz_participant" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "call_blitz" WHERE "call_blitz"."id" = "blitz_participant"."blitzId" AND "call_blitz"."organizationId" = requesting_org_id()));
CREATE POLICY "blitz_participant_insert" ON "blitz_participant" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "call_blitz" WHERE "call_blitz"."id" = "blitz_participant"."blitzId" AND "call_blitz"."organizationId" = requesting_org_id()));
CREATE POLICY "blitz_participant_update" ON "blitz_participant" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "call_blitz" WHERE "call_blitz"."id" = "blitz_participant"."blitzId" AND "call_blitz"."organizationId" = requesting_org_id()));
CREATE POLICY "blitz_participant_delete" ON "blitz_participant" FOR DELETE TO authenticated USING (false);
CREATE POLICY "blitz_participant_anon"   ON "blitz_participant" FOR ALL TO anon USING (false);

-- ---------- coach_card_trigger (via coach_card.organizationId) ----------
ALTER TABLE "coach_card_trigger" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_card_trigger_select" ON "coach_card_trigger" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "coach_card" WHERE "coach_card"."id" = "coach_card_trigger"."coachCardId" AND "coach_card"."organizationId" = requesting_org_id()));
CREATE POLICY "coach_card_trigger_insert" ON "coach_card_trigger" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "coach_card" WHERE "coach_card"."id" = "coach_card_trigger"."coachCardId" AND "coach_card"."organizationId" = requesting_org_id()));
CREATE POLICY "coach_card_trigger_update" ON "coach_card_trigger" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "coach_card" WHERE "coach_card"."id" = "coach_card_trigger"."coachCardId" AND "coach_card"."organizationId" = requesting_org_id()));
CREATE POLICY "coach_card_trigger_delete" ON "coach_card_trigger" FOR DELETE TO authenticated USING (false);
CREATE POLICY "coach_card_trigger_anon"   ON "coach_card_trigger" FOR ALL TO anon USING (false);

-- ---------- lead_contact_info (via lead.organizationId) ----------
ALTER TABLE "lead_contact_info" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_contact_info_select" ON "lead_contact_info" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "lead" WHERE "lead"."id" = "lead_contact_info"."leadId" AND "lead"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_contact_info_insert" ON "lead_contact_info" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "lead" WHERE "lead"."id" = "lead_contact_info"."leadId" AND "lead"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_contact_info_update" ON "lead_contact_info" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "lead" WHERE "lead"."id" = "lead_contact_info"."leadId" AND "lead"."organizationId" = requesting_org_id()));
CREATE POLICY "lead_contact_info_delete" ON "lead_contact_info" FOR DELETE TO authenticated USING (false);
CREATE POLICY "lead_contact_info_anon"   ON "lead_contact_info" FOR ALL TO anon USING (false);

-- ---------- research_approval (via research_task.organizationId) ----------
ALTER TABLE "research_approval" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_approval_select" ON "research_approval" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "research_task" WHERE "research_task"."id" = "research_approval"."researchTaskId" AND "research_task"."organizationId" = requesting_org_id()));
CREATE POLICY "research_approval_insert" ON "research_approval" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "research_task" WHERE "research_task"."id" = "research_approval"."researchTaskId" AND "research_task"."organizationId" = requesting_org_id()));
CREATE POLICY "research_approval_update" ON "research_approval" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "research_task" WHERE "research_task"."id" = "research_approval"."researchTaskId" AND "research_task"."organizationId" = requesting_org_id()));
CREATE POLICY "research_approval_delete" ON "research_approval" FOR DELETE TO authenticated USING (false);
CREATE POLICY "research_approval_anon"   ON "research_approval" FOR ALL TO anon USING (false);

-- ---------- agent_tool_execution (via agent_execution.organizationId) ----------
ALTER TABLE "agent_tool_execution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_tool_execution_select" ON "agent_tool_execution" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent_execution" WHERE "agent_execution"."id" = "agent_tool_execution"."executionId" AND "agent_execution"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_tool_execution_insert" ON "agent_tool_execution" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "agent_execution" WHERE "agent_execution"."id" = "agent_tool_execution"."executionId" AND "agent_execution"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_tool_execution_update" ON "agent_tool_execution" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "agent_execution" WHERE "agent_execution"."id" = "agent_tool_execution"."executionId" AND "agent_execution"."organizationId" = requesting_org_id()));
CREATE POLICY "agent_tool_execution_delete" ON "agent_tool_execution" FOR DELETE TO authenticated USING (false);
CREATE POLICY "agent_tool_execution_anon"   ON "agent_tool_execution" FOR ALL TO anon USING (false);

-- ---------- orchestration_step (via orchestration_job.organizationId) ----------
ALTER TABLE "orchestration_step" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orchestration_step_select" ON "orchestration_step" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "orchestration_job" WHERE "orchestration_job"."id" = "orchestration_step"."jobId" AND "orchestration_job"."organizationId" = requesting_org_id()));
CREATE POLICY "orchestration_step_insert" ON "orchestration_step" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "orchestration_job" WHERE "orchestration_job"."id" = "orchestration_step"."jobId" AND "orchestration_job"."organizationId" = requesting_org_id()));
CREATE POLICY "orchestration_step_update" ON "orchestration_step" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "orchestration_job" WHERE "orchestration_job"."id" = "orchestration_step"."jobId" AND "orchestration_job"."organizationId" = requesting_org_id()));
CREATE POLICY "orchestration_step_delete" ON "orchestration_step" FOR DELETE TO authenticated USING (false);
CREATE POLICY "orchestration_step_anon"   ON "orchestration_step" FOR ALL TO anon USING (false);

-- ---------- a2p_campaign (via a2p_brand_registration.organizationId) ----------
ALTER TABLE "a2p_campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "a2p_campaign_select" ON "a2p_campaign" FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "a2p_brand_registration" WHERE "a2p_brand_registration"."id" = "a2p_campaign"."brandRegistrationId" AND "a2p_brand_registration"."organizationId" = requesting_org_id()));
CREATE POLICY "a2p_campaign_insert" ON "a2p_campaign" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM "a2p_brand_registration" WHERE "a2p_brand_registration"."id" = "a2p_campaign"."brandRegistrationId" AND "a2p_brand_registration"."organizationId" = requesting_org_id()));
CREATE POLICY "a2p_campaign_update" ON "a2p_campaign" FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM "a2p_brand_registration" WHERE "a2p_brand_registration"."id" = "a2p_campaign"."brandRegistrationId" AND "a2p_brand_registration"."organizationId" = requesting_org_id()));
CREATE POLICY "a2p_campaign_delete" ON "a2p_campaign" FOR DELETE TO authenticated USING (false);
CREATE POLICY "a2p_campaign_anon"   ON "a2p_campaign" FOR ALL TO anon USING (false);


-- ============================================
-- Pattern 4: User-scoped tables
-- Filtered by userId instead of organizationId
-- ============================================

-- ---------- list_favorite ----------
ALTER TABLE "list_favorite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_favorite_select" ON "list_favorite" FOR SELECT TO authenticated USING ("userId" = requesting_user_id());
CREATE POLICY "list_favorite_insert" ON "list_favorite" FOR INSERT TO authenticated WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "list_favorite_update" ON "list_favorite" FOR UPDATE TO authenticated USING ("userId" = requesting_user_id()) WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "list_favorite_delete" ON "list_favorite" FOR DELETE TO authenticated USING (false);
CREATE POLICY "list_favorite_anon"   ON "list_favorite" FOR ALL TO anon USING (false);

-- ---------- list_open ----------
ALTER TABLE "list_open" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_open_select" ON "list_open" FOR SELECT TO authenticated USING ("userId" = requesting_user_id());
CREATE POLICY "list_open_insert" ON "list_open" FOR INSERT TO authenticated WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "list_open_update" ON "list_open" FOR UPDATE TO authenticated USING ("userId" = requesting_user_id()) WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "list_open_delete" ON "list_open" FOR DELETE TO authenticated USING (false);
CREATE POLICY "list_open_anon"   ON "list_open" FOR ALL TO anon USING (false);

-- ---------- notification ----------
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_select" ON "notification" FOR SELECT TO authenticated USING ("userId" = requesting_user_id());
CREATE POLICY "notification_insert" ON "notification" FOR INSERT TO authenticated WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "notification_update" ON "notification" FOR UPDATE TO authenticated USING ("userId" = requesting_user_id()) WITH CHECK ("userId" = requesting_user_id());
CREATE POLICY "notification_delete" ON "notification" FOR DELETE TO authenticated USING (false);
CREATE POLICY "notification_anon"   ON "notification" FOR ALL TO anon USING (false);


-- ============================================
-- No RLS tables (managed by BetterAuth or admin-only)
-- ============================================
-- The following tables have NO RLS policies (enable RLS + zero policies = deny all).
-- They are only accessed by the backend (postgres superuser) which bypasses RLS.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twoFactor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "example" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twilio_isv_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;
