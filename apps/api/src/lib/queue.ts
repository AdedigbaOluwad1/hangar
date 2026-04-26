import { Queue, Worker } from 'bullmq'
import { runPipeline } from '../pipeline'

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: 6379,
}

export const deployQueue = new Queue('deployments', { connection })

new Worker('deployments', async (job) => {
  await runPipeline(job.data.deploymentId, {
    resources: job.data.resources,
    previousDeploymentId: job.data.previousDeploymentId,
  })
}, { connection })

console.log('⚡ Deploy queue worker ready')