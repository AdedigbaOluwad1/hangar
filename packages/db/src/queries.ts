import { prisma } from './index'
import type { Deployment, Log } from '@prisma/client'
import type { DeploymentStatus } from '@hangar/types'

// ── Deployments ──────────────────────────────────────────

export async function createDeployment(data: {
  id: string
  sourceType: 'git' | 'zip'
  sourceUrl: string | null
}): Promise<Deployment> {
  return prisma.deployment.create({ data })
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  return prisma.deployment.findUnique({ where: { id } })
}

export async function listDeployments(): Promise<Deployment[]> {
  return prisma.deployment.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function updateDeployment(
  id: string,
  data: Partial<{
    status: DeploymentStatus
    imageTag: string
    containerId: string
    port: number
    liveUrl: string
  }>
): Promise<Deployment> {
  return prisma.deployment.update({ where: { id }, data })
}

// ── Logs ─────────────────────────────────────────────────

export async function writeLog(
  deploymentId: string,
  stream: 'build' | 'deploy' | 'system',
  line: string
): Promise<Log> {
  return prisma.log.create({ data: { deploymentId, stream, line } })
}

export async function getLogs(deploymentId: string): Promise<Log[]> {
  return prisma.log.findMany({
    where: { deploymentId },
    orderBy: { id: 'asc' },
  })
}