-- Add structured AI summary fields to lead table
ALTER TABLE "lead" ADD COLUMN "aiCompanyOverview" TEXT;
ALTER TABLE "lead" ADD COLUMN "aiSalesTalkingPoints" JSONB;
ALTER TABLE "lead" ADD COLUMN "aiBusinessContext" JSONB;
ALTER TABLE "lead" ADD COLUMN "aiSummaryGeneratedAt" TIMESTAMP(3);
ALTER TABLE "lead" ADD COLUMN "aiSummaryProvider" TEXT;
