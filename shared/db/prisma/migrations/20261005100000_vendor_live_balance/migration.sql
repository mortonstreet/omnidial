-- Store the vendor's real credit balance and last connection check, so the
-- enrichment settings show live account state instead of only OmniDial's
-- local usage counter.
-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

-- Nullable columns with no default: metadata-only, no table rewrite.
ALTER TABLE "data_vendor_connection" ADD COLUMN "vendorCreditsRemaining" INTEGER;
ALTER TABLE "data_vendor_connection" ADD COLUMN "creditsCheckedAt" TIMESTAMP(3);
ALTER TABLE "data_vendor_connection" ADD COLUMN "lastCheckStatus" TEXT;
ALTER TABLE "data_vendor_connection" ADD COLUMN "lastCheckMessage" TEXT;
