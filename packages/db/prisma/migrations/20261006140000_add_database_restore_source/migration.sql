-- AlterTable
ALTER TABLE "databases" ADD COLUMN "restore_source_id" TEXT,
ADD COLUMN "restore_backup" TEXT,
ADD COLUMN "restore_target" TEXT;
