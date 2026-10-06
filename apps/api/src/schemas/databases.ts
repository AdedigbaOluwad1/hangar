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
    lastBackupAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .openapi('Database')

export const CreateDatabaseBody = z
  .object({
    engine: z.enum(Object.keys(ENGINES) as [keyof typeof ENGINES, ...(keyof typeof ENGINES)[]]).openapi({ example: 'postgres' }),
    version: z.string().optional().openapi({ example: '16' }),
    plan: z.enum(DATABASE_PLAN_KEYS as [string, ...string[]]).openapi({ example: 'small' }),
  })
  .openapi('CreateDatabaseBody')
