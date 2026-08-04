-- AlterTable
ALTER TABLE "organization" ADD COLUMN "managedBySuperadmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "phone_provisioning" ADD COLUMN "usesMainAccount" BOOLEAN NOT NULL DEFAULT false;
