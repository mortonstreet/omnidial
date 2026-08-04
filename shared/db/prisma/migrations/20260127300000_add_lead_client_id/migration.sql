-- AlterTable: Add clientId field to lead for direct client assignment (not through campaign)
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

-- CreateIndex: Index for efficient client-based queries
CREATE INDEX IF NOT EXISTS "lead_clientId_idx" ON "lead"("clientId");

-- AddForeignKey: Link to client table with SET NULL on delete (skip if exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'lead_clientId_fkey' AND table_name = 'lead'
    ) THEN
        ALTER TABLE "lead" ADD CONSTRAINT "lead_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "client"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
