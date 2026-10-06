-- CreateEnum
CREATE TYPE "DatabaseEngine" AS ENUM ('postgres', 'mysql', 'mariadb', 'redis', 'valkey', 'ferretdb');

-- CreateEnum
CREATE TYPE "DatabaseStatus" AS ENUM ('provisioning', 'ready', 'degraded', 'stopped', 'failed', 'deleting');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('attaching', 'attached', 'detaching', 'failed');

-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('scheduled', 'manual', 'final');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "databases" (
    "id" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "engine" "DatabaseEngine" NOT NULL,
    "version" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "DatabaseStatus" NOT NULL DEFAULT 'provisioning',
    "status_reason" TEXT,
    "nomad_job_id" TEXT,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "volume_path" TEXT,
    "storage_gb" INTEGER NOT NULL,
    "project_id" SERIAL NOT NULL,
    "admin_vault_path" TEXT,
    "user_id" TEXT,
    "last_backup_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_attachments" (
    "id" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "env_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "vault_path" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'attaching',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_backups" (
    "id" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "kind" "BackupKind" NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'running',
    "size_bytes" BIGINT,
    "s3_key" TEXT,
    "restorable_from" TIMESTAMP(3),
    "restorable_to" TIMESTAMP(3),
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "database_backups_pkey" PRIMARY KEY ("id")
);

-- Project ids below 1000 are reserved for the platform
ALTER SEQUENCE "databases_project_id_seq" RESTART WITH 1000;

-- CreateIndex
CREATE UNIQUE INDEX "databases_callsign_key" ON "databases"("callsign");

-- CreateIndex
CREATE UNIQUE INDEX "databases_project_id_key" ON "databases"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "database_attachments_database_id_deployment_id_key" ON "database_attachments"("database_id", "deployment_id");

-- CreateIndex
CREATE UNIQUE INDEX "database_attachments_deployment_id_env_name_key" ON "database_attachments"("deployment_id", "env_name");

-- CreateIndex
CREATE INDEX "database_backups_database_id_started_at_idx" ON "database_backups"("database_id", "started_at");

-- AddForeignKey
ALTER TABLE "database_attachments" ADD CONSTRAINT "database_attachments_database_id_fkey" FOREIGN KEY ("database_id") REFERENCES "databases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_attachments" ADD CONSTRAINT "database_attachments_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_backups" ADD CONSTRAINT "database_backups_database_id_fkey" FOREIGN KEY ("database_id") REFERENCES "databases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
