import { Queue, Worker } from 'bullmq'
import { listAttachmentsByStatus, listDatabasesByStatus, updateAttachment, updateDatabase } from '@hangar/db'
import { redisConnection } from '../lib/queue'
import { attachDatabase, detachDatabase } from './attach'
import { deprovisionDatabase, provisionDatabase } from './provision'

export type DatabaseJobData =
  | { kind: 'provision'; databaseId: string }
  | { kind: 'deprovision'; databaseId: string }
  | { kind: 'attach'; attachmentId: string }
  | { kind: 'detach'; attachmentId: string }

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

export async function enqueueAttach(attachmentId: string): Promise<void> {
  await databaseQueue.add('attach', { kind: 'attach', attachmentId }, { ...jobOptions, jobId: `attach-${attachmentId}` })
}

export async function enqueueDetach(attachmentId: string): Promise<void> {
  await databaseQueue.add('detach', { kind: 'detach', attachmentId }, { ...jobOptions, jobId: `detach-${attachmentId}` })
}

export async function recoverDatabases(): Promise<void> {
  const stuck = await listDatabasesByStatus(['provisioning', 'deleting'])
  for (const db of stuck) {
    if (db.status === 'deleting') await enqueueDeprovision(db.id)
    else await enqueueProvision(db.id)
  }
  const pending = await listAttachmentsByStatus(['attaching', 'detaching'])
  for (const attachment of pending) {
    if (attachment.status === 'detaching') await enqueueDetach(attachment.id)
    else await enqueueAttach(attachment.id)
  }
  const total = stuck.length + pending.length
  if (total > 0) console.log(`Re-driving ${total} database operation(s) left mid-run`)
}

export const databaseWorker = new Worker<DatabaseJobData>(
  'databases',
  async (job) => {
    const data = job.data
    switch (data.kind) {
      case 'provision':
        if (job.attemptsMade > 0) await updateDatabase(data.databaseId, { status: 'provisioning', statusReason: null })
        await provisionDatabase(data.databaseId)
        break
      case 'deprovision':
        await deprovisionDatabase(data.databaseId)
        break
      case 'attach':
        if (job.attemptsMade > 0) await updateAttachment(data.attachmentId, { status: 'attaching' })
        await attachDatabase(data.attachmentId)
        break
      case 'detach':
        await detachDatabase(data.attachmentId)
        break
    }
  },
  { connection: redisConnection, concurrency: 2 },
)

databaseWorker.on('failed', (job, err) => {
  console.error(`Database ${job?.data.kind} failed: ${err.message}`)
})

recoverDatabases().catch((err) => console.error('Database recovery failed:', err))

console.log('⚡ Database queue worker ready')
