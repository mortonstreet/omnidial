-- AlterTable
ALTER TABLE "lead_list_folder" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "lead_list_folder_parentId_idx" ON "lead_list_folder"("parentId");

-- AddForeignKey
ALTER TABLE "lead_list_folder" ADD CONSTRAINT "lead_list_folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "lead_list_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
