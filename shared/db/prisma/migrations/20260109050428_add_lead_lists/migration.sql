-- CreateTable
CREATE TABLE "lead_list_folder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_list_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_list" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "importStatus" TEXT NOT NULL DEFAULT 'pending',
    "importError" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_list_entry" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_list_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_list" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_list_folder_organizationId_idx" ON "lead_list_folder"("organizationId");

-- CreateIndex
CREATE INDEX "lead_list_organizationId_idx" ON "lead_list"("organizationId");

-- CreateIndex
CREATE INDEX "lead_list_folderId_idx" ON "lead_list"("folderId");

-- CreateIndex
CREATE INDEX "lead_list_entry_listId_idx" ON "lead_list_entry"("listId");

-- CreateIndex
CREATE INDEX "lead_list_entry_leadId_idx" ON "lead_list_entry"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_list_entry_listId_leadId_key" ON "lead_list_entry"("listId", "leadId");

-- CreateIndex
CREATE INDEX "campaign_list_campaignId_idx" ON "campaign_list"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_list_listId_idx" ON "campaign_list"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_list_campaignId_listId_key" ON "campaign_list"("campaignId", "listId");

-- AddForeignKey
ALTER TABLE "lead_list_folder" ADD CONSTRAINT "lead_list_folder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list" ADD CONSTRAINT "lead_list_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list" ADD CONSTRAINT "lead_list_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "lead_list_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list" ADD CONSTRAINT "lead_list_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list_entry" ADD CONSTRAINT "lead_list_entry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lead_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_list_entry" ADD CONSTRAINT "lead_list_entry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_list" ADD CONSTRAINT "campaign_list_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_list" ADD CONSTRAINT "campaign_list_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lead_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;
