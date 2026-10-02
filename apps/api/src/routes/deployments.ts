import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { nanoid } from 'nanoid'
import { uuidv7 } from 'uuidv7'
import {
  createDeployment,
  createBuild,
  listDeployments,
  listBuilds,
  getDeployment,
  getBuild,
  updateDeployment,
  updateBuild,
  isCallsignTaken,
} from '@hangar/db'
import { getVault, deployQueue, stopJob, getJobStatus } from '../lib'
import { unpatchCaddy } from '../pipeline/caddy'
import { generateCallsign } from '../lib/callsign'
import {
  DeploymentIdParam,
  BuildIdParam,
  DeploymentSchema,
  DeploymentListSchema,
  BuildSchema,
  BuildListSchema,
  CreateDeploymentBody,
  ErrorSchema,
  MessageSchema,
  HealthSchema,
  TagsResponseSchema,
  RollbackBodySchema,
  RenameDeploymentBody,
} from '../schemas/deployments'

export const deployments = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.join('.')
      return c.json({ error: field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid request') }, 400)
    }
  },
})

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
    callsign: await generateCallsign(isCallsignTaken),
    sourceType: body.sourceType,
    sourceUrl: body.sourceUrl ?? null,
  })

  if (body.env && typeof body.env === 'object') {
    const vault = getVault()
    await vault.write(`hangar/data/deployments/${deployment.id}/env`, {
      data: body.env,
    })
  }

  const build = await createBuild({
    id: uuidv7(),
    deploymentId: deployment.id,
    trigger: 'deploy'
  })

  await deployQueue.add('deploy', {
    deploymentId: deployment.id,
    buildId: build.id,
    resources: body.resources,
  })

  return c.json({ ...deployment, latestBuild: build }, 201)
})

const renameRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Deployments'],
  summary: "Rename a deployment's callsign",
  request: {
    params: DeploymentIdParam,
    body: {
      required: true,
      content: { 'application/json': { schema: RenameDeploymentBody } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'The renamed deployment',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Callsign already taken by another deployment',
    },
  },
})

deployments.openapi(renameRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { callsign } = c.req.valid('json')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)
  if (callsign !== deployment.callsign && (await isCallsignTaken(callsign))) {
    return c.json({ error: `${callsign} is already taken` }, 409)
  }
  const renamed = await updateDeployment(id, { callsign })
  return c.json({ ...renamed, latestBuild: deployment.latestBuild }, 200)
})

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

  try { await stopJob(id) } catch { }
  if (deployment.liveUrl) {
    try { await unpatchCaddy(id) } catch { }
  }

  await updateDeployment(id, { status: 'stopped' })
  if (deployment.latestBuild?.status === 'running') {
    await updateBuild(deployment.latestBuild.id, { status: 'stopped' })
  }
  return c.json({ message: 'Deployment stopped' }, 200)
})

const redeployRoute = createRoute({
  method: 'post',
  path: '/{id}/redeploy',
  tags: ['Deployments'],
  summary: 'Redeploy from the same source — creates a new build under the same deployment',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'New build queued',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Deployment not found',
    },
  },
})

deployments.openapi(redeployRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)

  const build = await createBuild({
    id: uuidv7(),
    deploymentId: id,
    trigger: 'redeploy'
  })

  await deployQueue.add('deploy', {
    deploymentId: id,
    buildId: build.id,
  })

  return c.json({ ...deployment, latestBuild: build }, 200)
})

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

const tagsRoute = createRoute({
  method: 'get',
  path: '/{id}/tags',
  tags: ['Deployments'],
  summary: 'List available image tags for rollback (last 3, newest first)',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: TagsResponseSchema } },
      description: 'Available versioned tags',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Deployment not found',
    },
  },
})

deployments.openapi(tagsRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)

  const registryHost = process.env.REGISTRY_HOST ?? 'registry.hangar.local:5000'
  const res = await fetch(`http://${registryHost}/v2/hangar-${id}/tags/list`)
  if (!res.ok) return c.json({ tags: [] }, 200)

  const { tags } = await res.json() as { tags: string[] | null }
  if (!tags) return c.json({ tags: [] }, 200)

  const versioned = tags
    .filter(t => t !== 'latest' && t !== 'cache')
    .sort()
    .reverse()
    .slice(0, 3)

  return c.json({ tags: versioned }, 200)
})

const rollbackRoute = createRoute({
  method: 'post',
  path: '/{id}/rollback',
  tags: ['Deployments'],
  summary: 'Roll back to a previous image tag — skips build, redeploys existing image',
  request: {
    params: DeploymentIdParam,
    body: {
      required: true,
      content: { 'application/json': { schema: RollbackBodySchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeploymentSchema } },
      description: 'Rollback queued',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Deployment not found',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Tag not found in registry',
    },
  },
})

deployments.openapi(rollbackRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { tag } = c.req.valid('json')

  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)

  const registryHost = process.env.REGISTRY_HOST ?? 'registry.hangar.local:5000'
  const checkRes = await fetch(
    `http://${registryHost}/v2/hangar-${id}/manifests/${tag}`,
    {
      headers: {
        Accept:
          'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
      },
    }
  )
  if (!checkRes.ok) return c.json({ error: `Tag ${tag} not found in registry` }, 400)

  const build = await createBuild({
    id: uuidv7(),
    deploymentId: id,
    rollbackOf: tag,
    trigger: 'rollback'
  })

  const imageTag = `${registryHost}/hangar-${id}:${tag}`

  await deployQueue.add('deploy', {
    deploymentId: id,
    buildId: build.id,
    rollbackImageTag: imageTag,
  })

  return c.json({ ...deployment, latestBuild: build }, 200)
})

const listBuildsRoute = createRoute({
  method: 'get',
  path: '/{id}/builds',
  tags: ['Builds'],
  summary: 'List all builds for a deployment',
  request: { params: DeploymentIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: BuildListSchema } },
      description: 'List of builds, newest first',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Deployment not found',
    },
  },
})

deployments.openapi(listBuildsRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deployment = await getDeployment(id)
  if (!deployment) return c.json({ error: 'Not found' }, 404)
  return c.json(await listBuilds(id), 200)
})

const getBuildRoute = createRoute({
  method: 'get',
  path: '/{id}/builds/{buildId}',
  tags: ['Builds'],
  summary: 'Get a single build',
  request: { params: BuildIdParam },
  responses: {
    200: {
      content: { 'application/json': { schema: BuildSchema } },
      description: 'The build',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Build not found',
    },
  },
})

deployments.openapi(getBuildRoute, async (c) => {
  const { buildId } = c.req.valid('param')
  const build = await getBuild(buildId)
  if (!build) return c.json({ error: 'Not found' }, 404)
  return c.json(build, 200)
})