import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { nanoid } from 'nanoid'
import { createDeployment, listDeployments, getDeployment } from '@hangar/db'
import { deployQueue } from '../lib/queue'
import { getVault } from '../lib/config'
import {
  DeploymentIdParam,
  DeploymentSchema,
  DeploymentListSchema,
  CreateDeploymentBody,
  ErrorSchema,
} from '../schemas/deployment'

export const deployments = new OpenAPIHono()

// ---- GET / — list all deployments ----

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

// ---- GET /:id — get one deployment ----

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
      description: 'Deployment not found',
    },
  },
})

deployments.openapi(getOneRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)
  return c.json(deployment, 200)
})

// ---- POST / — create deployment ----

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

  await deployQueue.add('deploy', { deploymentId: deployment.id })

  return c.json(deployment, 201)
})