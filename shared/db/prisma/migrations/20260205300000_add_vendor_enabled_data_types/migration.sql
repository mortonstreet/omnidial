-- AlterTable
ALTER TABLE "data_vendor_connection" ADD COLUMN "enabledDataTypes" TEXT[] NOT NULL DEFAULT ARRAY['phone', 'email', 'profile'];
