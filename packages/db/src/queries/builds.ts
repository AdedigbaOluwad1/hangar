import { prisma } from '../prisma'
import type { Build, BuildStatus, BuildTrigger } from '@prisma/client'

export async function createBuild(data: {
  id: string
  deploymentId: string
  trigger?: BuildTrigger
  rollbackOf?: string
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

export async function isBuildTagInUse(tag: string): Promise<boolean> {
  const build = await prisma.build.findFirst({
    where: { imageTag: { contains: tag } },
  })
  return !!build
}