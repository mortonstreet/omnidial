-- Add website column to lead table
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "website" TEXT;
