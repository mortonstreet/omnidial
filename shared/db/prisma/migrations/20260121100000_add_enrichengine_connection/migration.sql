-- CreateTable: EnrichEngine API key-based connections
CREATE TABLE "enrichengine_connection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichengine_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique connection per organization
CREATE UNIQUE INDEX "enrichengine_connection_organizationId_key" ON "enrichengine_connection"("organizationId");

-- CreateIndex: For faster org lookups
CREATE INDEX "idx_enrichengine_connection_org" ON "enrichengine_connection"("organizationId");

-- AddForeignKey
ALTER TABLE "enrichengine_connection" ADD CONSTRAINT "enrichengine_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichengine_connection" ADD CONSTRAINT "enrichengine_connection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
