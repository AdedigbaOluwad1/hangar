import { Queue, Worker } from 'bullmq'
import { listDatabasesByStatus, updateDatabase } from '@hangar/db'
import { redisConnection } from '../lib/queue'
import { deprovisionDatabase, provisionDatabase } from './provision'

export type DatabaseJobData =
  | { kind: 'provision'; databaseId: string }
  | { kind: 'deprovision'; databaseId: string }

const ATTEMPTS = 3

const jobOptions = {
  attempts: ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 100,
}

export const databaseQueue = new Queue<DatabaseJobData>('databases', { connection: redisConnection })

export async function enqueueProvision(databaseId: string): Promise<void> {
  await databaseQueue.add('provision', { kind: 'provision', databaseId }, { ...jobOptions, jobId: `provision-${databaseId}` })
}

export async function enqueueDeprovision(databaseId: string): Promise<void> {
  await databaseQueue.add('deprovision', { kind: 'deprovision', databaseId }, { ...jobOptions, jobId: `deprovision-${databaseId}` })
}

export async function recoverDatabases(): Promise<void> {
  const stuck = await listDatabasesByStatus(['provisioning', 'deleting'])
  for (const db of stuck) {
    if (db.status === 'deleting') await enqueueDeprovision(db.id)
    else await enqueueProvision(db.id)
  }
  if (stuck.length > 0) console.log(`Re-driving ${stuck.length} database(s) left mid-operation`)
}

export const databaseWorker = new Worker<DatabaseJobData>(
  'databases',
  async (job) => {
    const { kind, databaseId } = job.data
    if (kind === 'provision') {
      if (job.attemptsMade > 0) await updateDatabase(databaseId, { status: 'provisioning', statusReason: null })
      await provisionDatabase(databaseId)
    } else {
      await deprovisionDatabase(databaseId)
    }
  },
  { connection: redisConnection, concurrency: 2 },
)

databaseWorker.on('failed', (job, err) => {
  console.error(`Database ${job?.data.kind} ${job?.data.databaseId} failed: ${err.message}`)
})

recoverDatabases().catch((err) => console.error('Database recovery failed:', err))

console.log('⚡ Database queue worker ready')
