import { prisma } from '../prisma'
import type {
  Database,
  DatabaseAttachment,
  DatabaseBackup,
  DatabaseEngine,
  DatabaseStatus,
  AttachmentStatus,
  BackupKind,
  BackupStatus,
} from '@prisma/client'

export async function createDatabase(data: {
  id: string
  callsign: string
  engine: DatabaseEngine
  version: string
  plan: string
  host: string
  port: number
  storageGb: number
  userId?: string
}): Promise<Database> {
  return prisma.database.create({ data })
}

export async function getDatabase(id: string): Promise<Database | null> {
  return prisma.database.findFirst({ where: { id, deletedAt: null } })
}

export async function listDatabases(): Promise<(Database & { attachments: DatabaseAttachment[] })[]> {
  return prisma.database.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { attachments: true },
  })
}

export async function isDatabaseCallsignTaken(callsign: string): Promise<boolean> {
  return (await prisma.database.count({ where: { callsign } })) > 0
}

export async function updateDatabase(
  id: string,
  data: Partial<{
    status: DatabaseStatus
    statusReason: string | null
    nomadJobId: string | null
    volumePath: string | null
    adminVaultPath: string | null
    lastBackupAt: Date | null
    deletedAt: Date | null
  }>,
): Promise<Database> {
  return prisma.database.update({ where: { id }, data })
}

export async function reservedStorageGb(): Promise<number> {
  const total = await prisma.database.aggregate({
    where: { deletedAt: null },
    _sum: { storageGb: true },
  })
  return total._sum.storageGb ?? 0
}

export async function listDatabasesByStatus(statuses: DatabaseStatus[]): Promise<Database[]> {
  return prisma.database.findMany({ where: { deletedAt: null, status: { in: statuses } } })
}

export async function createAttachment(data: {
  id: string
  databaseId: string
  deploymentId: string
  envName: string
  username: string
  vaultPath: string
}): Promise<DatabaseAttachment> {
  return prisma.databaseAttachment.create({ data })
}

export async function getAttachment(id: string): Promise<DatabaseAttachment | null> {
  return prisma.databaseAttachment.findUnique({ where: { id } })
}

export async function listAttachmentsForDeployment(deploymentId: string): Promise<DatabaseAttachment[]> {
  return prisma.databaseAttachment.findMany({ where: { deploymentId }, orderBy: { createdAt: 'asc' } })
}

export async function listAttachmentsByStatus(statuses: AttachmentStatus[]): Promise<DatabaseAttachment[]> {
  return prisma.databaseAttachment.findMany({ where: { status: { in: statuses } } })
}

export async function listAttachmentsForDatabase(databaseId: string): Promise<DatabaseAttachment[]> {
  return prisma.databaseAttachment.findMany({ where: { databaseId }, orderBy: { createdAt: 'asc' } })
}

export async function updateAttachment(
  id: string,
  data: Partial<{ status: AttachmentStatus; envName: string }>,
): Promise<DatabaseAttachment> {
  return prisma.databaseAttachment.update({ where: { id }, data })
}

export async function deleteAttachment(id: string): Promise<void> {
  await prisma.databaseAttachment.delete({ where: { id } })
}

export async function createBackup(data: {
  id: string
  databaseId: string
  kind: BackupKind
}): Promise<DatabaseBackup> {
  return prisma.databaseBackup.create({ data })
}

export async function listBackups(databaseId: string): Promise<DatabaseBackup[]> {
  return prisma.databaseBackup.findMany({ where: { databaseId }, orderBy: { startedAt: 'desc' } })
}

export async function updateBackup(
  id: string,
  data: Partial<{
    status: BackupStatus
    sizeBytes: bigint | null
    s3Key: string | null
    restorableFrom: Date | null
    restorableTo: Date | null
    error: string | null
    finishedAt: Date | null
  }>,
): Promise<DatabaseBackup> {
  return prisma.databaseBackup.update({ where: { id }, data })
}

export async function getBackup(id: string): Promise<DatabaseBackup | null> {
  return prisma.databaseBackup.findUnique({ where: { id } })
}

export async function listBackupsByStatus(statuses: BackupStatus[]): Promise<DatabaseBackup[]> {
  return prisma.databaseBackup.findMany({ where: { status: { in: statuses } } })
}

export async function deleteBackupsBefore(databaseId: string, cutoff: Date): Promise<void> {
  await prisma.databaseBackup.deleteMany({ where: { databaseId, status: 'completed', startedAt: { lt: cutoff } } })
}
