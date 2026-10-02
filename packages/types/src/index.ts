import { type DeploymentStatus, type BuildStatus, type BuildTrigger } from '@prisma/client'

export type { DeploymentStatus, BuildStatus, BuildTrigger }

export interface Build {
  id: string
  deploymentId: string
  status: BuildStatus
  trigger: BuildTrigger
  rollbackOf: string | null
  imageTag: string | null
  createdAt: string
  updatedAt: string
}

export interface Deployment {
  id: string
  callsign: string
  status: DeploymentStatus
  sourceType: 'git' | 'zip'
  sourceUrl: string | null
  imageTag: string | null
  containerId: string | null
  liveUrl: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  latestBuild: Build | null
}

export interface LogLine {
  buildId: string
  stream: 'build' | 'deploy' | 'system'
  line: string
  createdAt: string
}

export interface Resources {
  cpu?: number
  memoryMb?: number
}

export interface CreateDeploymentInput {
  sourceType: 'git' | 'zip'
  sourceUrl?: string
  env?: Record<string, string>
  resources?: Resources
}

export interface Health {
  status: string
  allocId: string | null
}

export interface ApiResponse<T> {
  data: T
  error?: string
}