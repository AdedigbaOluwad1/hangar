import type {
  DatabaseEngine,
  DatabaseStatus,
  AttachmentStatus,
  BackupKind,
  BackupStatus,
} from '@prisma/client'

export type { DatabaseEngine, DatabaseStatus, AttachmentStatus, BackupKind, BackupStatus }

export const DATABASE_PLANS = {
  small: { label: 'Small', cpu: 250, memoryMb: 512, storageGb: 5, backupRetentionDays: 7 },
  medium: { label: 'Medium', cpu: 500, memoryMb: 1024, storageGb: 20, backupRetentionDays: 14 },
  large: { label: 'Large', cpu: 1000, memoryMb: 2048, storageGb: 50, backupRetentionDays: 14 },
} as const

export type DatabasePlan = keyof typeof DATABASE_PLANS

export const DATABASE_PLAN_KEYS = Object.keys(DATABASE_PLANS) as DatabasePlan[]

export interface EngineSpec {
  label: string
  versions: readonly string[]
  defaultVersion: string
  port: number
  urlScheme: string
  defaultEnvName: string
  extraEnvNames: readonly string[]
  minPlan: DatabasePlan
  pitr: boolean
}

export const ENGINES: Record<DatabaseEngine, EngineSpec> = {
  postgres: {
    label: 'PostgreSQL',
    versions: ['16'],
    defaultVersion: '16',
    port: 5432,
    urlScheme: 'postgresql',
    defaultEnvName: 'DATABASE_URL',
    extraEnvNames: [],
    minPlan: 'small',
    pitr: true,
  },
  mysql: {
    label: 'MySQL',
    versions: ['8.4'],
    defaultVersion: '8.4',
    port: 3306,
    urlScheme: 'mysql',
    defaultEnvName: 'DATABASE_URL',
    extraEnvNames: [],
    minPlan: 'small',
    pitr: false,
  },
  mariadb: {
    label: 'MariaDB',
    versions: ['11.4'],
    defaultVersion: '11.4',
    port: 3306,
    urlScheme: 'mysql',
    defaultEnvName: 'DATABASE_URL',
    extraEnvNames: [],
    minPlan: 'small',
    pitr: false,
  },
  redis: {
    label: 'Redis',
    versions: ['8'],
    defaultVersion: '8',
    port: 6379,
    urlScheme: 'redis',
    defaultEnvName: 'REDIS_URL',
    extraEnvNames: [],
    minPlan: 'small',
    pitr: false,
  },
  valkey: {
    label: 'Valkey',
    versions: ['9'],
    defaultVersion: '9',
    port: 6379,
    urlScheme: 'redis',
    defaultEnvName: 'REDIS_URL',
    extraEnvNames: ['VALKEY_URL'],
    minPlan: 'small',
    pitr: false,
  },
  ferretdb: {
    label: 'MongoDB-compatible (FerretDB)',
    versions: ['2'],
    defaultVersion: '2',
    port: 27017,
    urlScheme: 'mongodb',
    defaultEnvName: 'MONGODB_URI',
    extraEnvNames: [],
    minPlan: 'medium',
    pitr: true,
  },
}

export interface Database {
  id: string
  callsign: string
  engine: DatabaseEngine
  version: string
  plan: string
  status: DatabaseStatus
  statusReason: string | null
  host: string
  port: number
  storageGb: number
  lastBackupAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DatabaseAttachment {
  id: string
  databaseId: string
  deploymentId: string
  envName: string
  status: AttachmentStatus
  createdAt: string
  updatedAt: string
}

export interface DatabaseBackup {
  id: string
  databaseId: string
  kind: BackupKind
  status: BackupStatus
  sizeBytes: number | null
  restorableFrom: string | null
  restorableTo: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface CreateDatabaseInput {
  engine: DatabaseEngine
  version?: string
  plan: DatabasePlan
  attachTo?: { deploymentId: string; envName?: string }
}

export interface AttachDatabaseInput {
  databaseId: string
  envName?: string
}
