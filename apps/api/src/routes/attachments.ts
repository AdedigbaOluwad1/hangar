import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { nanoid } from 'nanoid'
import {
  createAttachment,
  getAttachment,
  getDatabase,
  getDeployment,
  listAttachmentsForDeployment,
  updateAttachment,
} from '@hangar/db'
import { ENGINES } from '@hangar/types'
import { readEnv } from '../lib'
import { getDriver } from '../databases/driver'
import { attachmentEnvKeys } from '../databases/env'
import { databaseJobId } from '../databases/names'
import { enqueueAttach, enqueueDetach } from '../databases/queue'
import { AttachDatabaseBody, AttachmentIdParam, DatabaseAttachmentSchema } from '../schemas/databases'
import { DeploymentIdParam, ErrorSchema } from '../schemas/deployments'

export const attachments = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.join('.')
      return c.json({ error: field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid request') }, 400)
    }
  },
})

function publicAttachment(a: { id: string; deploymentId: string; envName: string; status: 'attaching' | 'attached' | 'detaching' | 'failed'; createdAt: Date }) {
  return { id: a.id, deploymentId: a.deploymentId, envName: a.envName, status: a.status, createdAt: a.createdAt }
}

const attachRoute = createRoute({
  method: 'post',
  path: '/{id}/attachments',
  tags: ['Databases'],
  summary: 'Attach a database to an app',
  request: {
    params: DeploymentIdParam,
    body: { required: true, content: { 'application/json': { schema: AttachDatabaseBody } } },
  },
  responses: {
    202: {
      content: { 'application/json': { schema: DatabaseAttachmentSchema } },
      description: 'Attachment created; the app restarts with the new variables once it is attached',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid variable name',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'App or database not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database not ready, already attached, or the variable name is taken',
    },
  },
})

attachments.openapi(attachRoute, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)
  const database = await getDatabase(body.databaseId)
  if (!database) return c.json({ error: 'Database not found' }, 404)
  if (database.status !== 'ready') return c.json({ error: `The database is ${database.status}, not ready.` }, 409)

  const existing = await listAttachmentsForDeployment(id)
  if (existing.some((a) => a.databaseId === database.id)) {
    return c.json({ error: 'This database is already attached to the app.' }, 409)
  }

  const envName = body.envName ?? ENGINES[database.engine].defaultEnvName
  const driver = getDriver(database.engine)
  const keys = attachmentEnvKeys(database.engine, envName, driver.appDatabase)
  const { vars } = await readEnv(id)
  const clash = keys.find((key) => key in vars)
  if (clash || existing.some((a) => a.envName === envName)) {
    const taken = clash ?? envName
    return c.json({ error: `${taken} is already set. Choose another variable name.` }, body.envName ? 409 : 400)
  }

  const attachmentId = `att-${nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, '')}`
  const attachment = await createAttachment({
    id: attachmentId,
    databaseId: database.id,
    deploymentId: id,
    envName,
    username: `app_${attachmentId.slice(4)}`,
    vaultPath: `hangar/data/databases/${databaseJobId(database.id)}/attachments/${attachmentId}`,
  })
  await enqueueAttach(attachment.id)

  return c.json(publicAttachment(attachment), 202)
})

const detachRoute = createRoute({
  method: 'delete',
  path: '/{id}/attachments/{attachmentId}',
  tags: ['Databases'],
  summary: 'Detach a database from an app',
  request: { params: AttachmentIdParam },
  responses: {
    202: {
      content: { 'application/json': { schema: DatabaseAttachmentSchema } },
      description: 'Detaching; the app restarts without the variables once it is done',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'The attachment is still being attached or detached',
    },
  },
})

attachments.openapi(detachRoute, async (c) => {
  const { id, attachmentId } = c.req.valid('param')
  const attachment = await getAttachment(attachmentId)
  if (!attachment || attachment.deploymentId !== id) return c.json({ error: 'Not found' }, 404)
  if (attachment.status === 'attaching' || attachment.status === 'detaching') {
    return c.json({ error: `The attachment is ${attachment.status}. Try again once it settles.` }, 409)
  }

  const detaching = await updateAttachment(attachmentId, { status: 'detaching' })
  await enqueueDetach(attachmentId)

  return c.json(publicAttachment(detaching), 202)
})
