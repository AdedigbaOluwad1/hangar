import { type DeploymentStatus, type BuildStatus } from '@prisma/client'

export type { DeploymentStatus, BuildStatus }

export interface Deployment {
  id: string
  status: DeploymentStatus
  sourceType: 'git' | 'zip'
  sourceUrl: string | null
  imageTag: string | null
  containerId: string | null
  liveUrl: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
}

export interface Build {
  id: string
  deploymentId: string
  status: BuildStatus
  imageTag: string | null
  createdAt: string
  updatedAt: string
}

export interface LogLine {
  buildId: string
  stream: 'build' | 'deploy' | 'system'
  line: string
  createdAt: string
}

export interface CreateDeploymentInput {
  sourceType: 'git' | 'zip'
  sourceUrl?: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}