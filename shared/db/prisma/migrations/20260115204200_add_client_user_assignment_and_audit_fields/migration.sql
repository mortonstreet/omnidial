-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastModifiedById" TEXT;

-- AlterTable
ALTER TABLE "lead_list" ADD COLUMN     "lastModifiedById" TEXT;

-- AlterTable
ALTER TABLE "lead_list_folder" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastModifiedById" TEXT;

-- CreateTable
CREATE TABLE "client_user_assignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_user_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_user_assignment_organizationId_idx" ON "client_user_assignment"("organizationId");

-- CreateIndex
CREATE INDEX "client_user_assignment_userId_idx" ON "client_user_assignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_assignment_clientId_userId_key" ON "client_user_assignment"("clientId", "userId");

-- CreateIndex
CREATE INDEX "lead_createdById_idx" ON "lead"("createdById");

-- CreateIndex
CREATE INDEX "lead_lastModifiedById_idx" ON "lead"("lastModifiedById");

-- CreateIndex
CREATE INDEX "lead_list_lastModifiedById_idx" ON "lead_list"("lastModifiedById");

-- CreateIndex
CREATE INDEX "lead_list_folder_createdById_idx" ON "lead_list_folder"("createdById");

-- CreateIndex
CREATE INDEX "lead_list_folder_lastModifiedById_idx" ON "lead_list_folder"("lastModifiedById");

-- AddForeignKey
ALTER TABLE "client_user_assignment" ADD CONSTRAINT "client_user_assignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_user_assignment" ADD CONSTRAINT "client_user_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list_folder" ADD CONSTRAINT "lead_list_folder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list_folder" ADD CONSTRAINT "lead_list_folder_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list" ADD CONSTRAINT "lead_list_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
