import { prisma } from '../prisma'
import type { Log } from '@prisma/client'

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