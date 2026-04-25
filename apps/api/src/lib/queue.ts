import { Queue, Worker } from 'bullmq';
import { runPipeline } from '../pipeline';

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: 6379,
}

export const deployQueue = new Queue('deployments', { connection })

// worker runs in same process for now
new Worker('deployments', async (job) => {
  await runPipeline(job.data.deploymentId)
}, { connection })

console.log('⚡ Deploy queue worker ready')