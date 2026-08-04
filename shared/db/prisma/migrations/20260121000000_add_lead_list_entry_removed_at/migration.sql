-- Add removedAt column to lead_list_entry table for soft delete functionality
ALTER TABLE "lead_list_entry" ADD COLUMN "removedAt" TIMESTAMP(3);
