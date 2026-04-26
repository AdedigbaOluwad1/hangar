import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { nanoid } from 'nanoid'
import { createDeployment, listDeployments, getDeployment, updateDeployment } from '@hangar/db'
import { deployQueue } from '../lib/queue'
import { getVault } from '../lib/config'
import { stopJob, getJobStatus } from '../lib/nomad'
import { unpatchCaddy } from '../pipeline/caddy'
import {
  DeploymentIdParam,
  DeploymentSchema,
  DeploymentListSchema,
  CreateDeploymentBody,
  ErrorSchema,
  MessageSchema,
  HealthSchema,
} from '../schemas/deployments'

export const deployments = new OpenAPIHono()

// ── GET / — list ──────────────────────────────────────────

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Deployments'],
  summary: 'List all deployments',
  responses: {
    200: {
      content: { 'application/json': { schema: DeploymentListSchema } },
      description: 'Array of all deployments',
    },
  },
})

deployments.openapi(listRoute, async (c) => {
  return c.json(await listDeployments(), 200)
})

// ── GET /:id — get one ────────────────────────────────────

const getOneRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Deployments'],
  summary: 'Get a single deployment',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'The deployment',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not found',
    },
  },
})

deployments.openapi(getOneRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)
  return c.json(deployment, 200)
})

// ── POST / — create ───────────────────────────────────────

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  tags: ['Deployments'],
  summary: 'Create and trigger a new deployment',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateDeploymentBody } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'Deployment created and queued',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid request body',
    },
  },
})

deployments.openapi(createRoute_, async (c) => {
  const body = c.req.valid('json')

  if (body.sourceType === 'git' && !body.sourceUrl) {
    return c.json({ error: 'sourceUrl required for git deploys' }, 400)
  }

  const deployment = await createDeployment({
    id: `dep-${nanoid(8).toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    sourceType: body.sourceType,
    sourceUrl: body.sourceUrl ?? null,
  })

  if (body.env && typeof body.env === 'object') {
    const vault = getVault()
    await vault.write(`hangar/data/deployments/${deployment.id}/env`, {
      data: body.env,
    })
  }

  await deployQueue.add('deploy', {
    deploymentId: deployment.id,
    resources: body.resources,
  })

  return c.json(deployment, 201)
})

// ── DELETE /:id — stop + remove ───────────────────────────

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Deployments'],
  summary: 'Stop and delete a deployment',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: MessageSchema } },
      description: 'Deployment stopped',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not found',
    },
  },
})

deployments.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)

  // Stop Nomad job (also removes the container)
  try { await stopJob(id) } catch { /* already stopped */ }

  // Remove Caddy route if it was live
  if (deployment.liveUrl) {
    try { await unpatchCaddy(id) } catch { /* route may not exist */ }
  }

  await updateDeployment(id, { status: 'stopped' })

  return c.json({ message: 'Deployment stopped' }, 200)
})

// ── POST /:id/redeploy ────────────────────────────────────

const redeployRoute = createRoute({
  method: 'post',
  path: '/{id}/redeploy',
  tags: ['Deployments'],
  summary: 'Redeploy from the same source — creates a new deployment, stops the old one on success',
  request: { params: DeploymentIdParam },
  responses: {
    201: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'New deployment created and queued',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Original deployment not found',
    },
  },
})

deployments.openapi(redeployRoute, async (c) => {
  const { id } = c.req.valid('param')
  const old = await getDeployment(id)
  if (!old) return c.json({ error: 'Not found' }, 404)

  // Copy env from Vault into the new deployment
  let existingEnv: Record<string, string> = {}
  try {
    const vault = getVault()
    const result = await vault.read(`hangar/data/deployments/${id}/env`)
    existingEnv = result?.data?.data ?? {}
  } catch { /* no env stored */ }

  const newDeployment = await createDeployment({
    id: `dep-${nanoid(8).toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    sourceType: old.sourceType as 'git' | 'zip',
    sourceUrl: old.sourceUrl,
  })

  if (Object.keys(existingEnv).length > 0) {
    const vault = getVault()
    await vault.write(`hangar/data/deployments/${newDeployment.id}/env`, {
      data: existingEnv,
    })
  }

  // Queue the new deployment — pass the old ID so the worker can stop it on success
  await deployQueue.add('deploy', {
    deploymentId: newDeployment.id,
    previousDeploymentId: id,
  })

  return c.json(newDeployment, 201)
})

// ── GET /:id/health ───────────────────────────────────────

const healthRoute = createRoute({
  method: 'get',
  path: '/{id}/health',
  tags: ['Deployments'],
  summary: 'Check the health of a running deployment via Nomad',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: HealthSchema } },
      description: 'Current alloc status from Nomad',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Deployment not found',
    },
  },
})

deployments.openapi(healthRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)

  const health = await getJobStatus(id)
  return c.json(
    { status: health?.status ?? 'unknown', allocId: health?.allocId ?? null },
    200
  )
})