-- AlterTable
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "hasPersonalVoicemail" BOOLEAN;

-- AlterTable
ALTER TABLE "lead_predictive_score" ADD COLUMN IF NOT EXISTS "hasPersonalVoicemail" BOOLEAN;
