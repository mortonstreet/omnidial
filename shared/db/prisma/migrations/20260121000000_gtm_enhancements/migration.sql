-- OmniDial Enhancements Migration
-- Adds: Parallel Dialing, Predictive Scoring, Sales Floor, AI Live Coach, Local Presence, Multi-Vendor Enrichment

-- ============================================
-- Modify existing tables
-- ============================================

-- Add columns to call table
ALTER TABLE "call" ADD COLUMN "parallelSessionId" TEXT;
ALTER TABLE "call" ADD COLUMN "wasParallelAbandoned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "call" ADD COLUMN "predictiveScore" DECIMAL(5,4);
ALTER TABLE "call" ADD COLUMN "poolNumberId" TEXT;

CREATE INDEX "call_parallelSessionId_idx" ON "call"("parallelSessionId");

-- Add columns to lead table
ALTER TABLE "lead" ADD COLUMN "phoneType" TEXT;
ALTER TABLE "lead" ADD COLUMN "totalCallAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lead" ADD COLUMN "totalAnswers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lead" ADD COLUMN "lastCallAt" TIMESTAMP(3);
ALTER TABLE "lead" ADD COLUMN "enrichmentStatus" TEXT;
ALTER TABLE "lead" ADD COLUMN "enrichmentSources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add columns to campaign_lead table
ALTER TABLE "campaign_lead" ADD COLUMN "predictiveScore" DECIMAL(5,4);
ALTER TABLE "campaign_lead" ADD COLUMN "scoreDialOrder" INTEGER;

CREATE INDEX "campaign_lead_campaignId_predictiveScore_idx" ON "campaign_lead"("campaignId", "predictiveScore" DESC);

-- Add columns to active_dialer_session table
ALTER TABLE "active_dialer_session" ADD COLUMN "currentLeadId" TEXT;
ALTER TABLE "active_dialer_session" ADD COLUMN "currentLeadName" TEXT;
ALTER TABLE "active_dialer_session" ADD COLUMN "callsThisSession" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "active_dialer_session" ADD COLUMN "connectedThisSession" INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- Parallel Dialing Tables
-- ============================================

CREATE TABLE "parallel_dial_session" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "listId" TEXT,
    "lineCount" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'active',
    "conferenceId" TEXT,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalConnects" INTEGER NOT NULL DEFAULT 0,
    "totalAbandoned" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_dial_session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parallel_dial_session_organizationId_status_idx" ON "parallel_dial_session"("organizationId", "status");
CREATE INDEX "parallel_dial_session_userId_idx" ON "parallel_dial_session"("userId");

CREATE TABLE "parallel_dial_attempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "callSid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'dialing',
    "wasConnected" BOOLEAN NOT NULL DEFAULT false,
    "wasAbandoned" BOOLEAN NOT NULL DEFAULT false,
    "abandonedAfterMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "parallel_dial_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parallel_dial_attempt_callSid_key" ON "parallel_dial_attempt"("callSid");
CREATE INDEX "parallel_dial_attempt_sessionId_idx" ON "parallel_dial_attempt"("sessionId");
CREATE INDEX "parallel_dial_attempt_leadId_idx" ON "parallel_dial_attempt"("leadId");

ALTER TABLE "parallel_dial_attempt" ADD CONSTRAINT "parallel_dial_attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "parallel_dial_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Predictive Scoring Tables
-- ============================================

CREATE TABLE "lead_predictive_score" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" DECIMAL(5,4) NOT NULL,
    "phoneType" TEXT,
    "bestDayOfWeek" INTEGER,
    "bestHourOfDay" INTEGER,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastAnswerAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_predictive_score_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_predictive_score_leadId_key" ON "lead_predictive_score"("leadId");
CREATE INDEX "lead_predictive_score_organizationId_score_idx" ON "lead_predictive_score"("organizationId", "score" DESC);
CREATE INDEX "lead_predictive_score_leadId_idx" ON "lead_predictive_score"("leadId");

CREATE TABLE "call_answer_pattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "answers" INTEGER NOT NULL DEFAULT 0,
    "answerRate" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_answer_pattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_answer_pattern_organizationId_dayOfWeek_hourOfDay_key" ON "call_answer_pattern"("organizationId", "dayOfWeek", "hourOfDay");
CREATE INDEX "call_answer_pattern_organizationId_idx" ON "call_answer_pattern"("organizationId");

-- ============================================
-- Virtual Sales Floor Tables
-- ============================================

CREATE TABLE "call_blitz" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "goalType" TEXT NOT NULL DEFAULT 'calls',
    "goalTarget" INTEGER,
    "prizeDescription" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_blitz_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_blitz_organizationId_status_idx" ON "call_blitz"("organizationId", "status");
CREATE INDEX "call_blitz_organizationId_startAt_idx" ON "call_blitz"("organizationId", "startAt");

CREATE TABLE "blitz_participant" (
    "id" TEXT NOT NULL,
    "blitzId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "connectCount" INTEGER NOT NULL DEFAULT 0,
    "meetingCount" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blitz_participant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blitz_participant_blitzId_userId_key" ON "blitz_participant"("blitzId", "userId");
CREATE INDEX "blitz_participant_blitzId_rank_idx" ON "blitz_participant"("blitzId", "rank");

ALTER TABLE "blitz_participant" ADD CONSTRAINT "blitz_participant_blitzId_fkey" FOREIGN KEY ("blitzId") REFERENCES "call_blitz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "manager_listen_session" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "conferenceSid" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'listen',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_listen_session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manager_listen_session_organizationId_idx" ON "manager_listen_session"("organizationId");
CREATE INDEX "manager_listen_session_managerId_idx" ON "manager_listen_session"("managerId");
CREATE INDEX "manager_listen_session_repId_idx" ON "manager_listen_session"("repId");
CREATE INDEX "manager_listen_session_callId_idx" ON "manager_listen_session"("callId");

-- ============================================
-- AI Live Coach Tables
-- ============================================

CREATE TABLE "coach_card" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "triggerPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL,
    "tips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_card_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_card_organizationId_isActive_idx" ON "coach_card"("organizationId", "isActive");
CREATE INDEX "coach_card_organizationId_category_idx" ON "coach_card"("organizationId", "category");

CREATE TABLE "coach_card_trigger" (
    "id" TEXT NOT NULL,
    "coachCardId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerPhrase" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "wasHelpful" BOOLEAN,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_card_trigger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coach_card_trigger_coachCardId_idx" ON "coach_card_trigger"("coachCardId");
CREATE INDEX "coach_card_trigger_callId_idx" ON "coach_card_trigger"("callId");
CREATE INDEX "coach_card_trigger_userId_idx" ON "coach_card_trigger"("userId");

ALTER TABLE "coach_card_trigger" ADD CONSTRAINT "coach_card_trigger_coachCardId_fkey" FOREIGN KEY ("coachCardId") REFERENCES "coach_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "live_transcript_segment" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL DEFAULT 'unknown',
    "text" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_transcript_segment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "live_transcript_segment_callId_startMs_idx" ON "live_transcript_segment"("callId", "startMs");
CREATE INDEX "live_transcript_segment_organizationId_idx" ON "live_transcript_segment"("organizationId");

-- ============================================
-- Local Presence Tables
-- ============================================

CREATE TABLE "phone_number_pool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "friendlyName" TEXT,
    "areaCode" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "twilioSid" TEXT,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cnamStatus" TEXT,
    "cnamName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "callsToday" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_number_pool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phone_number_pool_organizationId_phoneNumber_key" ON "phone_number_pool"("organizationId", "phoneNumber");
CREATE UNIQUE INDEX "phone_number_pool_twilioSid_key" ON "phone_number_pool"("twilioSid");
CREATE INDEX "phone_number_pool_organizationId_areaCode_idx" ON "phone_number_pool"("organizationId", "areaCode");
CREATE INDEX "phone_number_pool_organizationId_isActive_idx" ON "phone_number_pool"("organizationId", "isActive");

CREATE TABLE "callback_route" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "poolNumberId" TEXT NOT NULL,
    "leadPhone" TEXT NOT NULL,
    "repUserId" TEXT NOT NULL,
    "lastCallAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callback_route_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "callback_route_poolNumberId_leadPhone_key" ON "callback_route"("poolNumberId", "leadPhone");
CREATE INDEX "callback_route_organizationId_idx" ON "callback_route"("organizationId");
CREATE INDEX "callback_route_leadPhone_idx" ON "callback_route"("leadPhone");
CREATE INDEX "callback_route_expiresAt_idx" ON "callback_route"("expiresAt");

ALTER TABLE "callback_route" ADD CONSTRAINT "callback_route_poolNumberId_fkey" FOREIGN KEY ("poolNumberId") REFERENCES "phone_number_pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Multi-Vendor Enrichment Tables
-- ============================================

CREATE TABLE "data_vendor_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsLimit" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "connectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_vendor_connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "data_vendor_connection_organizationId_provider_key" ON "data_vendor_connection"("organizationId", "provider");
CREATE INDEX "data_vendor_connection_organizationId_isActive_idx" ON "data_vendor_connection"("organizationId", "isActive");

CREATE TABLE "lead_contact_info" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "confidence" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_contact_info_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_contact_info_leadId_type_idx" ON "lead_contact_info"("leadId", "type");
CREATE INDEX "lead_contact_info_leadId_isPrimary_idx" ON "lead_contact_info"("leadId", "isPrimary");

CREATE TABLE "enrichment_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorConnectionId" TEXT,
    "provider" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "fieldsRequested" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fieldsEnriched" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditsCost" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "responseTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "enrichment_history_organizationId_createdAt_idx" ON "enrichment_history"("organizationId", "createdAt" DESC);
CREATE INDEX "enrichment_history_leadId_idx" ON "enrichment_history"("leadId");
CREATE INDEX "enrichment_history_vendorConnectionId_idx" ON "enrichment_history"("vendorConnectionId");

ALTER TABLE "enrichment_history" ADD CONSTRAINT "enrichment_history_vendorConnectionId_fkey" FOREIGN KEY ("vendorConnectionId") REFERENCES "data_vendor_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
