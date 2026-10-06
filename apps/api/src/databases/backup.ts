import {
  deleteBackupsBefore,
  getBackup,
  getDatabase,
  updateBackup,
  updateDatabase,
} from '@hangar/db'
import { DATABASE_PLANS } from '@hangar/types'
import type { DatabasePlan } from '@hangar/types'
import {
  destroySecret,
  listJobAllocations,
  maskLine,
  readAllocStdout,
  readSecret,
  stopJobById,
  submitJobSpec,
  writeSecret,
} from '../lib'
import { getDriver } from './driver'
import { parseBackupList } from './backup-list'
import { buildBackupJobSpec } from './job'
import { adminVaultPath, backupJobId, backupSecretPath, walgVaultPath } from './names'
import { readAdminCredentials, toSpec } from './provision'

const BACKUP_TIMEOUT_MS = 30 * 60_000
const POLL_MS = 5000
const TERMINAL = ['complete', 'failed', 'lost']
const DAY_MS = 86_400_000

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForJob(jobId: string): Promise<{ id: string; status: string }> {
  const deadline = Date.now() + BACKUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const allocs = await listJobAllocations(jobId)
    if (allocs.length > 0 && allocs.every((alloc) => TERMINAL.includes(alloc.ClientStatus))) {
      const last = allocs[allocs.length - 1]
      return { id: last.ID, status: last.ClientStatus }
    }
    await sleep(POLL_MS)
  }
  throw new Error('Timed out waiting for the backup to finish')
}

export async function runBackup(backupId: string): Promise<void> {
  const backup = await getBackup(backupId)
  if (!backup) throw new Error(`Backup ${backupId} not found`)
  if (backup.status === 'completed') return
  const row = await getDatabase(backup.databaseId)
  if (!row) throw new Error(`Database ${backup.databaseId} not found`)
  const db = toSpec(row)
  const driver = getDriver(db.engine)
  const jobId = backupJobId(db.id, backupId)
  let secrets: string[] = []

  try {
    const admin = await readAdminCredentials(db.id)
    const walg = await readSecret(walgVaultPath(db.id))
    if (!walg?.access_key || !walg?.secret_key) throw new Error('Backup credentials are missing')
    secrets = [admin.password, walg.secret_key]
    await writeSecret(backupSecretPath(jobId), {
      password: admin.password,
      access_key: walg.access_key,
      secret_key: walg.secret_key,
    })

    await stopJobById(jobId, true)
    await submitJobSpec(buildBackupJobSpec(db, driver, backupId))
    const alloc = await waitForJob(jobId)
    if (alloc.status !== 'complete') throw new Error('The backup job did not complete')

    const stdout = await readAllocStdout(alloc.id, 'backup')
    const parsed = parseBackupList(stdout)
    if (!parsed) throw new Error(`The backup finished but could not be read back from the archive: ${stdout.slice(0, 300)}`)

    const finishedAt = parsed.finishedAt ?? new Date()
    await updateBackup(backupId, {
      status: 'completed',
      s3Key: parsed.name,
      sizeBytes: parsed.sizeBytes === null ? null : BigInt(parsed.sizeBytes),
      restorableFrom: finishedAt,
      error: null,
      finishedAt,
    })
    await updateDatabase(db.id, { lastBackupAt: finishedAt })
    const retentionDays = DATABASE_PLANS[db.plan as DatabasePlan]?.backupRetentionDays ?? 7
    await deleteBackupsBefore(db.id, new Date(Date.now() - retentionDays * DAY_MS))
  } catch (err) {
    const reason = maskLine(err instanceof Error ? err.message : String(err), secrets).slice(0, 500)
    await updateBackup(backupId, { status: 'failed', error: reason, finishedAt: new Date() })
    throw new Error(reason)
  } finally {
    await stopJobById(jobId, true).catch(() => {})
    await destroySecret(backupSecretPath(jobId)).catch(() => {})
  }
}
