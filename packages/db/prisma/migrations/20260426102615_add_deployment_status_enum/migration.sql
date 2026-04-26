/*
  Warnings:

  - The `status` column on the `deployments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'building', 'deploying', 'running', 'failed', 'stopped');

-- AlterTable
ALTER TABLE "deployments" DROP COLUMN "status",
ADD COLUMN     "status" "DeploymentStatus" NOT NULL DEFAULT 'pending';
