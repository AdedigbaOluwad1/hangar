import { Queue, Worker } from 'bullmq'
import { runPipeline } from '../pipeline'

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://redis:6379')

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
}

interface DeployJobData {
  deploymentId: string
  buildId: string
  resources?: { cpu?: number; memoryMb?: number }
  rollbackImageTag?: string
}

export const deployQueue = new Queue<DeployJobData>('deployments', { connection })

new Worker<DeployJobData>('deployments', async (job) => {
  await runPipeline(job.data.deploymentId, job.data.buildId, {
    resources: job.data.resources,
    rollbackImageTag: job.data.rollbackImageTag,
  })
}, { connection })

console.log('⚡ Deploy queue worker ready')