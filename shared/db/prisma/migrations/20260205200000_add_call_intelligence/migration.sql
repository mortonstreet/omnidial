-- CreateTable
CREATE TABLE "call_intelligence" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,

    -- AI Analysis Results (JSON fields)
    "decisionMaker" JSONB DEFAULT '{}',
    "currentStrategies" JSONB DEFAULT '[]',
    "painPoints" JSONB DEFAULT '[]',
    "techStack" JSONB DEFAULT '[]',
    "talkingPoints" JSONB DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',

    -- Analysis metadata
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "analysisTimeMs" INTEGER NOT NULL DEFAULT 0,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_intelligence_callId_key" ON "call_intelligence"("callId");

-- CreateIndex
CREATE INDEX "call_intelligence_organizationId_idx" ON "call_intelligence"("organizationId");

-- CreateIndex
CREATE INDEX "call_intelligence_userId_idx" ON "call_intelligence"("userId");

-- CreateIndex
CREATE INDEX "call_intelligence_callId_idx" ON "call_intelligence"("callId");

-- CreateIndex
CREATE INDEX "call_intelligence_leadId_idx" ON "call_intelligence"("leadId");

-- AddForeignKey
ALTER TABLE "call_intelligence" ADD CONSTRAINT "call_intelligence_callId_fkey" FOREIGN KEY ("callId") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_intelligence" ADD CONSTRAINT "call_intelligence_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "call_transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_intelligence" ADD CONSTRAINT "call_intelligence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
