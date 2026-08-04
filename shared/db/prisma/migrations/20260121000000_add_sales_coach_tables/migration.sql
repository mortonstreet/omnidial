-- CreateTable
CREATE TABLE "call_transcript" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "transcriptSource" TEXT NOT NULL DEFAULT 'twilio',
    "speakerLabels" JSONB NOT NULL DEFAULT '[]',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_coaching" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "unhingedQuote" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedback" JSONB NOT NULL DEFAULT '{}',
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-3-sonnet',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "analysisTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_coaching_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_transcript_callId_key" ON "call_transcript"("callId");

-- CreateIndex
CREATE INDEX "call_transcript_organizationId_idx" ON "call_transcript"("organizationId");

-- CreateIndex
CREATE INDEX "call_transcript_callId_idx" ON "call_transcript"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "call_coaching_callId_key" ON "call_coaching"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "call_coaching_transcriptId_key" ON "call_coaching"("transcriptId");

-- CreateIndex
CREATE INDEX "call_coaching_organizationId_idx" ON "call_coaching"("organizationId");

-- CreateIndex
CREATE INDEX "call_coaching_userId_idx" ON "call_coaching"("userId");

-- CreateIndex
CREATE INDEX "call_coaching_callId_idx" ON "call_coaching"("callId");

-- CreateIndex
CREATE INDEX "call_coaching_overallScore_idx" ON "call_coaching"("overallScore");

-- AddForeignKey
ALTER TABLE "call_transcript" ADD CONSTRAINT "call_transcript_callId_fkey" FOREIGN KEY ("callId") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_coaching" ADD CONSTRAINT "call_coaching_callId_fkey" FOREIGN KEY ("callId") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_coaching" ADD CONSTRAINT "call_coaching_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "call_transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
