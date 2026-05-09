import { z } from '@hono/zod-openapi'

export const DeploymentIdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: 'dep-a1b2c3d4',
  }),
})

export const BuildIdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: 'dep-a1b2c3d4',
  }),
  buildId: z.string().openapi({
    param: { name: 'buildId', in: 'path' },
    example: '01966a1e-7c4f-7000-8000-1234567890ab',
  }),
})

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: 'Not found' }),
  })
  .openapi('Error')

export const MessageSchema = z
  .object({
    message: z.string().openapi({ example: 'Deployment stopped' }),
  })
  .openapi('Message')

export const HealthSchema = z
  .object({
    status: z.string().openapi({ example: 'running' }),
    allocId: z.string().nullable().openapi({ example: 'abc-def-123' }),
  })
  .openapi('Health')

export const LatestBuildSchema = z
  .object({
    id: z.string(),
    status: z.enum(['building', 'deploying', 'running', 'failed', 'stopped']),
    imageTag: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .nullable()
  .openapi('LatestBuild')

export const DeploymentSchema = z
  .object({
    id: z.string().openapi({ example: 'dep-a1b2c3d4' }),
    status: z
      .enum(['pending', 'running', 'failed', 'stopped'])
      .openapi({ example: 'running' }),
    sourceType: z.string().openapi({ example: 'git' }),
    sourceUrl: z.string().nullable().openapi({ example: 'https://github.com/you/repo' }),
    imageTag: z.string().nullable().openapi({ example: 'registry.service.consul:5000/hangar-dep-a1b2c3d4:01966a1e-...' }),
    containerId: z.string().nullable().openapi({ example: null }),
    liveUrl: z.string().nullable().openapi({ example: 'http://dep-a1b2c3d4.localhost' }),
    userId: z.string().nullable().openapi({ example: null }),
    createdAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
    latestBuild: LatestBuildSchema,
  })
  .openapi('Deployment')

export const DeploymentListSchema = z.array(DeploymentSchema).openapi('DeploymentList')

export const BuildSchema = z
  .object({
    id: z.string().openapi({ example: '01966a1e-7c4f-7000-8000-1234567890ab' }),
    deploymentId: z.string().openapi({ example: 'dep-a1b2c3d4' }),
    status: z
      .enum(['building', 'deploying', 'running', 'failed', 'stopped'])
      .openapi({ example: 'running' }),
    imageTag: z.string().nullable().openapi({ example: 'registry.service.consul:5000/hangar-dep-a1b2c3d4:01966a1e-...' }),
    createdAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  })
  .openapi('Build')

export const BuildListSchema = z.array(BuildSchema).openapi('BuildList')

export const ResourcesSchema = z
  .object({
    cpu: z.number().int().min(100).max(8000).optional().openapi({
      example: 500,
      description: 'CPU in MHz. Default: 500',
    }),
    memoryMb: z.number().int().min(128).max(32768).optional().openapi({
      example: 512,
      description: 'Memory in MB. Default: 512',
    }),
  })
  .openapi('Resources')

export const CreateDeploymentBody = z
  .object({
    sourceType: z.enum(['git', 'zip']).openapi({ example: 'git' }),
    sourceUrl: z.string().url().optional().openapi({
      example: 'https://github.com/you/repo',
    }),
    env: z.record(z.string(), z.string()).optional().openapi({
      example: { NODE_ENV: 'production' },
    }),
    resources: ResourcesSchema.optional(),
  })
  .openapi('CreateDeploymentBody')

export const TagsResponseSchema = z
  .object({
    tags: z.array(z.string()).openapi({ example: ['01966a1e-...', '01966a0b-...'] }),
  })
  .openapi('TagsResponse')

export const RollbackBodySchema = z
  .object({
    tag: z.string().openapi({ example: '01966a1e-7c4f-7000-8000-1234567890ab' }),
  })
  .openapi('RollbackBody')



