-- CreateTable
CREATE TABLE "enrichment_cache" (
    "id" TEXT NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "lookupType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrichment_cache_lookupKey_provider_key" ON "enrichment_cache"("lookupKey", "provider");

-- CreateIndex
CREATE INDEX "enrichment_cache_lookupKey_idx" ON "enrichment_cache"("lookupKey");

-- CreateIndex
CREATE INDEX "enrichment_cache_expiresAt_idx" ON "enrichment_cache"("expiresAt");

-- AlterTable
ALTER TABLE "integration" ADD COLUMN "autoSyncToCrm" BOOLEAN NOT NULL DEFAULT false;
