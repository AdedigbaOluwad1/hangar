import { Queue, Worker } from 'bullmq'
import { runPipeline } from '../pipeline'

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://redis:6379')

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
}

export const deployQueue = new Queue('deployments', { connection })

new Worker('deployments', async (job) => {
  await runPipeline(job.data.deploymentId, {
    resources: job.data.resources,
    previousDeploymentId: job.data.previousDeploymentId,
  })
}, { connection })

console.log('⚡ Deploy queue worker ready')