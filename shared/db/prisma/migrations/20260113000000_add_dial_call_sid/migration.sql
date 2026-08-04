-- AlterTable
ALTER TABLE "call" ADD COLUMN "dialCallSid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "call_dialCallSid_key" ON "call"("dialCallSid");
