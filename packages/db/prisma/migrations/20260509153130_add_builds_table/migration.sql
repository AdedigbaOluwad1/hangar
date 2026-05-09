/*
  Warnings:

  - The values [building,deploying] on the enum `DeploymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deployment_id` on the `logs` table. All the data in the column will be lost.
  - Added the required column `build_id` to the `logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('building', 'deploying', 'running', 'failed');

-- AlterEnum
BEGIN;
CREATE TYPE "DeploymentStatus_new" AS ENUM ('pending', 'running', 'failed', 'stopped');
ALTER TABLE "public"."deployments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "deployments" ALTER COLUMN "status" TYPE "DeploymentStatus_new" USING ("status"::text::"DeploymentStatus_new");
ALTER TYPE "DeploymentStatus" RENAME TO "DeploymentStatus_old";
ALTER TYPE "DeploymentStatus_new" RENAME TO "DeploymentStatus";
DROP TYPE "public"."DeploymentStatus_old";
ALTER TABLE "deployments" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- DropForeignKey
ALTER TABLE "logs" DROP CONSTRAINT "logs_deployment_id_fkey";

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "logs" DROP COLUMN "deployment_id",
ADD COLUMN     "build_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "status" "BuildStatus" NOT NULL DEFAULT 'building',
    "image_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
