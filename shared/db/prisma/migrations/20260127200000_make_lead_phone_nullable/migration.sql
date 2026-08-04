-- Make phone column nullable to support "wrong number" disposition flow
-- When a number is marked as wrong, the phone is cleared but lead data is preserved
ALTER TABLE "lead" ALTER COLUMN "phone" DROP NOT NULL;
