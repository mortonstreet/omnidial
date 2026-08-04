-- Add must reset password fields to user table for admin password reset
ALTER TABLE "user" ADD COLUMN "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "passwordResetAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "passwordResetByUserId" TEXT;
