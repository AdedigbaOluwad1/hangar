import { prisma } from '../prisma'
import type { Deployment, Build, DeploymentStatus } from '@prisma/client'

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