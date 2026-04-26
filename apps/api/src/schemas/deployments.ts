import { z } from '@hono/zod-openapi'

export const DeploymentIdParam = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: 'dep-a1b2c3d4',
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

export const DeploymentSchema = z
  .object({
    id: z.string().openapi({ example: 'dep-a1b2c3d4' }),
    status: z
      .enum(['pending', 'building', 'deploying', 'running', 'failed', 'stopped'])
      .openapi({ example: 'running' }),
    sourceType: z.string().openapi({ example: 'git' }),
    sourceUrl: z.string().nullable().openapi({ example: 'https://github.com/you/repo' }),
    imageTag: z.string().nullable().openapi({ example: 'localhost:5000/hangar-dep-a1b2c3d4:latest' }),
    containerId: z.string().nullable().openapi({ example: null }),
    liveUrl: z.string().nullable().openapi({ example: 'http://localhost/deploys/dep-a1b2c3d4' }),
    createdAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  })
  .openapi('Deployment')

export const DeploymentListSchema = z.array(DeploymentSchema).openapi('DeploymentList')

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