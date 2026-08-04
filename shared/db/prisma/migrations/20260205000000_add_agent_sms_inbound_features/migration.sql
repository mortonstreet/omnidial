-- Add columns for inbound SMS tracking to agent_message table
ALTER TABLE "agent_message" ADD COLUMN IF NOT EXISTS "direction" VARCHAR(10) DEFAULT 'outbound';
ALTER TABLE "agent_message" ADD COLUMN IF NOT EXISTS "fromPhone" VARCHAR(20);
ALTER TABLE "agent_message" ADD COLUMN IF NOT EXISTS "replyToMessageId" VARCHAR(36);

-- Add columns for autonomous SMS mode to agent_sms_config table
ALTER TABLE "agent_sms_config" ADD COLUMN IF NOT EXISTS "autonomousEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "agent_sms_config" ADD COLUMN IF NOT EXISTS "maxRepliesPerLead" INT DEFAULT 5;

-- Add index on direction for filtering
CREATE INDEX IF NOT EXISTS "agent_message_direction_idx" ON "agent_message"("direction");

-- Add index on fromPhone for looking up conversations
CREATE INDEX IF NOT EXISTS "agent_message_fromPhone_idx" ON "agent_message"("fromPhone");

-- Add index on twilioPhoneNumber for webhook lookups
CREATE INDEX IF NOT EXISTS "agent_sms_config_twilioPhoneNumber_idx" ON "agent_sms_config"("twilioPhoneNumber");

-- Add foreign key for replyToMessageId (self-referencing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_message_replyToMessageId_fkey'
    ) THEN
        ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_replyToMessageId_fkey"
        FOREIGN KEY ("replyToMessageId") REFERENCES "agent_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
