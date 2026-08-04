-- AlterTable
ALTER TABLE "lead" ADD COLUMN "timezone" TEXT;
ALTER TABLE "lead" ADD COLUMN "timezoneResolvedAt" TIMESTAMP(3);
