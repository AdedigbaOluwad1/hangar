import { z } from '@hono/zod-openapi'
import { DATABASE_PLAN_KEYS, ENGINES } from '@hangar/types'

export const DatabaseIdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: 'db-a1b2c3d4',
  }),
})

export const DatabaseSchema = z
  .object({
    id: z.string().openapi({ example: 'db-a1b2c3d4' }),
    callsign: z.string().openapi({ example: 'cobalt-heron' }),
    engine: z.enum(Object.keys(ENGINES) as [keyof typeof ENGINES, ...(keyof typeof ENGINES)[]]).openapi({ example: 'postgres' }),
    version: z.string().openapi({ example: '16' }),
    plan: z.string().openapi({ example: 'small' }),
    status: z.enum(['provisioning', 'ready', 'degraded', 'stopped', 'failed', 'deleting']),
    statusReason: z.string().nullable(),
    host: z.string().openapi({ example: 'db-cobalt-heron' }),
    port: z.number().int().openapi({ example: 5432 }),
    storageGb: z.number().int().openapi({ example: 5 }),
    restoreSourceId: z.string().nullable(),
    lastBackupAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .openapi('Database')

export const DatabaseAttachmentSchema = z
  .object({
    id: z.string(),
    deploymentId: z.string().openapi({ example: 'dep-a1b2c3d4' }),
    envName: z.string().openapi({ example: 'DATABASE_URL' }),
    status: z.enum(['attaching', 'attached', 'detaching', 'failed']),
    createdAt: z.coerce.date(),
  })
  .openapi('DatabaseAttachment')

export const DatabaseDetailSchema = DatabaseSchema.extend({
  attachments: z.array(DatabaseAttachmentSchema),
}).openapi('DatabaseDetail')

export const DatabaseListSchema = z.array(DatabaseDetailSchema).openapi('DatabaseList')

export const CreateDatabaseBody = z
  .object({
    engine: z.enum(Object.keys(ENGINES) as [keyof typeof ENGINES, ...(keyof typeof ENGINES)[]]).openapi({ example: 'postgres' }),
    version: z.string().optional().openapi({ example: '16' }),
    plan: z.enum(DATABASE_PLAN_KEYS as [string, ...string[]]).openapi({ example: 'small' }),
  })
  .openapi('CreateDatabaseBody')

export const AttachmentIdParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'dep-a1b2c3d4' }),
  attachmentId: z.string().openapi({ param: { name: 'attachmentId', in: 'path' }, example: 'att-a1b2c3d4' }),
})

export const AttachDatabaseBody = z
  .object({
    databaseId: z.string().openapi({ example: 'db-a1b2c3d4' }),
    envName: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*_(URL|URI)$/, 'Use capital letters, digits and underscores, ending in _URL or _URI')
      .max(100)
      .optional()
      .openapi({ example: 'DATABASE_URL' }),
  })
  .openapi('AttachDatabaseBody')

export const DatabaseBackupSchema = z
  .object({
    id: z.string().openapi({ example: 'bak-a1b2c3d4e5' }),
    databaseId: z.string(),
    kind: z.enum(['scheduled', 'manual', 'final']),
    status: z.enum(['running', 'completed', 'failed']),
    sizeBytes: z.number().int().nullable(),
    restorableFrom: z.coerce.date().nullable(),
    restorableTo: z.coerce.date().nullable(),
    error: z.string().nullable(),
    startedAt: z.coerce.date(),
    finishedAt: z.coerce.date().nullable(),
  })
  .openapi('DatabaseBackup')

export const DatabaseBackupListSchema = z.array(DatabaseBackupSchema).openapi('DatabaseBackupList')

export const RestoreDatabaseBody = z
  .object({
    backupId: z.string().optional().openapi({ example: 'bak-a1b2c3d4e5' }),
    time: z.string().datetime().optional().openapi({ example: '2026-10-06T08:30:41Z' }),
  })
  .openapi('RestoreDatabaseBody')
