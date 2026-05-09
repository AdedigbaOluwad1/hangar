-- CreateEnum
CREATE TYPE "BuildTrigger" AS ENUM ('deploy', 'redeploy', 'rollback');

-- AlterTable
ALTER TABLE "builds" ADD COLUMN     "rollback_of" TEXT,
ADD COLUMN     "trigger" "BuildTrigger" NOT NULL DEFAULT 'deploy';
