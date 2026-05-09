import { prisma } from '.'
import type { Deployment, Build, Log } from '@prisma/client'
import type { DeploymentStatus, BuildStatus } from '@hangar/types'

// ── Deployments ──────────────────────────────────────────

export async function createDeployment(data: {
  id: string
  sourceType: 'git' | 'zip'
  sourceUrl: string | null
  userId?: string
}): Promise<Deployment> {
  return prisma.deployment.create({ data })
}

export async function getDeployment(id: string): Promise<(Deployment & { latestBuild: Build | null }) | null> {
  return prisma.deployment.findUnique({
    where: { id },
    include: {
      builds: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  }).then(d => {
    if (!d) return null
    const { builds, ...deployment } = d
    return { ...deployment, latestBuild: builds[0] ?? null }
  })
}

export async function listDeployments(): Promise<(Deployment & { latestBuild: Build | null })[]> {
  const deployments = await prisma.deployment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      builds: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  return deployments.map(({ builds, ...deployment }) => ({
    ...deployment,
    latestBuild: builds[0] ?? null,
  }))
}

export async function updateDeployment(
  id: string,
  data: Partial<{
    status: DeploymentStatus
    imageTag: string
    containerId: string
    liveUrl: string
  }>
): Promise<Deployment> {
  return prisma.deployment.update({ where: { id }, data })
}

// ── Builds ───────────────────────────────────────────────

export async function createBuild(data: {
  id: string       // uuidv7 — used as image tag version
  deploymentId: string
}): Promise<Build> {
  return prisma.build.create({ data })
}

export async function getBuild(id: string): Promise<Build | null> {
  return prisma.build.findUnique({ where: { id } })
}

export async function getLatestBuild(deploymentId: string): Promise<Build | null> {
  return prisma.build.findFirst({
    where: { deploymentId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listBuilds(deploymentId: string): Promise<Build[]> {
  return prisma.build.findMany({
    where: { deploymentId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function updateBuild(
  id: string,
  data: Partial<{
    status: BuildStatus
    imageTag: string
  }>
): Promise<Build> {
  return prisma.build.update({ where: { id }, data })
}

export async function stopPreviousBuilds(
  deploymentId: string,
  currentBuildId: string,
): Promise<void> {
  await prisma.build.updateMany({
    where: {
      deploymentId,
      id: { not: currentBuildId },
      status: { in: ['building', 'deploying', 'running'] },
    },
    data: { status: 'stopped' },
  })
}

// ── Logs ─────────────────────────────────────────────────

export async function writeLog(
  buildId: string,
  stream: 'build' | 'deploy' | 'system',
  line: string
): Promise<Log> {
  return prisma.log.create({ data: { buildId, stream, line } })
}

export async function getLogs(buildId: string): Promise<Log[]> {
  return prisma.log.findMany({
    where: { buildId },
    orderBy: { id: 'asc' },
  })
}