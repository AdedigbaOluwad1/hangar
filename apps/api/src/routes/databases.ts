import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { nanoid } from 'nanoid'
import {
  createDatabase,
  getDatabase,
  isDatabaseCallsignTaken,
  listAttachmentsForDatabase,
  reservedStorageGb,
  updateDatabase,
} from '@hangar/db'
import { DATABASE_PLANS, ENGINES } from '@hangar/types'
import { generateCallsign } from '../lib/callsign'
import { checkCapacity, resolveRequest } from '../databases/admission'
import { getDriver } from '../databases/driver'
import { databaseHost } from '../databases/names'
import { enqueueDeprovision, enqueueProvision } from '../databases/queue'
import { CreateDatabaseBody, DatabaseIdParam, DatabaseSchema } from '../schemas/databases'
import { ErrorSchema } from '../schemas/deployments'

export const databases = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.join('.')
      return c.json({ error: field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid request') }, 400)
    }
  },
})

function storageCapacityGb(): number | null {
  const value = parseInt(process.env.HANGAR_DB_CAPACITY_GB ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  tags: ['Databases'],
  summary: 'Create a managed database',
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateDatabaseBody } } },
  },
  responses: {
    202: {
      content: { 'application/json': { schema: DatabaseSchema } },
      description: 'Database created and provisioning',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid engine, version or plan',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not enough database storage',
    },
  },
})

databases.openapi(createRoute_, async (c) => {
  const body = c.req.valid('json')

  try {
    getDriver(body.engine)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400)
  }

  const resolved = resolveRequest(body)
  if ('error' in resolved) return c.json({ error: resolved.error }, 400)

  const storageGb = DATABASE_PLANS[resolved.plan].storageGb
  const shortage = checkCapacity(await reservedStorageGb(), storageGb, storageCapacityGb())
  if (shortage) return c.json({ error: shortage }, 409)

  const callsign = await generateCallsign(isDatabaseCallsignTaken)
  const database = await createDatabase({
    id: `db-${nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    callsign,
    engine: body.engine,
    version: resolved.version,
    plan: resolved.plan,
    host: databaseHost(callsign),
    port: ENGINES[body.engine].port,
    storageGb,
  })

  await enqueueProvision(database.id)

  return c.json(database, 202)
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Databases'],
  summary: 'Delete a managed database',
  request: { params: DatabaseIdParam },
  responses: {
    202: {
      content: { 'application/json': { schema: DatabaseSchema } },
      description: 'Database is being deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database is attached to apps or mid-operation',
    },
  },
})

databases.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid('param')
  const database = await getDatabase(id)
  if (!database) return c.json({ error: 'Not found' }, 404)
  if (database.status === 'provisioning' || database.status === 'deleting') {
    return c.json({ error: `The database is ${database.status}. Try again once it settles.` }, 409)
  }

  const attachments = await listAttachmentsForDatabase(id)
  if (attachments.length > 0) {
    const count = attachments.length
    return c.json({ error: `Attached to ${count} app${count === 1 ? '' : 's'}. Detach ${count === 1 ? 'it' : 'them'} first.` }, 409)
  }

  const deleting = await updateDatabase(id, { status: 'deleting', statusReason: null })
  await enqueueDeprovision(id)

  return c.json(deleting, 202)
})
