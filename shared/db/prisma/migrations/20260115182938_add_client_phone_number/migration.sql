-- CreateTable
CREATE TABLE "client_phone_number" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "friendlyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_phone_number_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_phone_number_organizationId_idx" ON "client_phone_number"("organizationId");

-- CreateIndex
CREATE INDEX "client_phone_number_clientId_idx" ON "client_phone_number"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_phone_number_organizationId_phoneNumber_key" ON "client_phone_number"("organizationId", "phoneNumber");

-- AddForeignKey
ALTER TABLE "client_phone_number" ADD CONSTRAINT "client_phone_number_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
