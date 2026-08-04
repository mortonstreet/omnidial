-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_organizationId_idx" ON "client"("organizationId");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable - Add new columns first
ALTER TABLE "campaign" ADD COLUMN "clientId" TEXT;
ALTER TABLE "campaign" ADD COLUMN "lastCalledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "campaign_clientId_idx" ON "campaign"("clientId");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable - Remove old columns
ALTER TABLE "campaign" DROP COLUMN IF EXISTS "status";
ALTER TABLE "campaign" DROP COLUMN IF EXISTS "type";
