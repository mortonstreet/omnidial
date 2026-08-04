-- CreateTable
CREATE TABLE "voicemail_greeting" (
    "id" TEXT NOT NULL,
    "twilioConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "recordingSid" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voicemail_greeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voicemail_greeting_twilioConfigId_idx" ON "voicemail_greeting"("twilioConfigId");

-- AddForeignKey
ALTER TABLE "voicemail_greeting" ADD CONSTRAINT "voicemail_greeting_twilioConfigId_fkey" FOREIGN KEY ("twilioConfigId") REFERENCES "twilio_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add voicemail inbox fields to call
ALTER TABLE "call" ADD COLUMN "voicemailLeft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "call" ADD COLUMN "voicemailReadAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "call_voicemailLeft_idx" ON "call"("voicemailLeft");

-- Backfill: Mark existing inbound calls with recordings as voicemails
UPDATE "call" SET "voicemailLeft" = true WHERE "direction" = 'inbound' AND "recordingUrl" IS NOT NULL;
