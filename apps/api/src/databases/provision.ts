import { randomBytes } from 'node:crypto'
import { getDatabase, updateDatabase } from '@hangar/db'
import {
  destroySecret,
  getConfig,
  listJobAllocations,
  maskLine,
  readSecret,
  stopJobById,
  submitJobSpec,
  writeSecret,
  writeSecretOnce,
} from '../lib'
import { getDriver } from './driver'
import type { DatabaseConnection, DatabaseSpec } from './driver'
import { buildCleanupJobSpec, buildDatabaseJobSpec, buildRestoreJobSpec } from './job'
import {
  adminVaultPath,
  backupPrefix,
  backupSecretPath,
  cleanupJobId,
  databaseFqdn,
  databaseJobId,
  databaseVolumeDir,
  restoreJobId,
  walgVaultPath,
} from './names'

const HEALTH_TIMEOUT_MS = 180_000
const RESTORE_TIMEOUT_MS = 30 * 60_000
const POLL_MS = 3000
const TERMINAL = ['complete', 'failed', 'lost']

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return
    await sleep(POLL_MS)
  }
  throw new Error(`Timed out waiting for ${what}`)
}

async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      await sleep(delayMs)
    }
  }
  throw last
}

async function consulAddr(): Promise<string> {
  const config = await getConfig().catch(() => ({}) as Record<string, string>)
  return process.env.CONSUL_ADDR ?? config.consul_addr ?? 'http://10.88.0.1:8500'
}

async function serviceHealthy(host: string): Promise<boolean> {
  const res = await fetch(`${await consulAddr()}/v1/health/service/${host}?passing=true`)
  if (!res.ok) return false
  const services = (await res.json()) as unknown[]
  return services.length > 0
}

export function toSpec(row: DatabaseSpec): DatabaseSpec {
  return {
    id: row.id,
    callsign: row.callsign,
    engine: row.engine,
    version: row.version,
    plan: row.plan,
    host: row.host,
    port: row.port,
    storageGb: row.storageGb,
    projectId: row.projectId,
  }
}

export async function readAdminCredentials(id: string): Promise<{ username: string; password: string }> {
  const secret = await readSecret(adminVaultPath(id))
  if (!secret?.username || !secret?.password) throw new Error('Admin credentials are missing')
  return { username: secret.username, password: secret.password }
}

export function connectionFor(db: DatabaseSpec, admin: { username: string; password: string }): DatabaseConnection {
  return { host: databaseFqdn(db.host), port: db.port, user: admin.username, password: admin.password }
}

async function ensureCredentials(db: DatabaseSpec, adminUser: string): Promise<{ username: string; password: string }> {
  await writeSecretOnce(adminVaultPath(db.id), {
    username: adminUser,
    password: randomBytes(24).toString('hex'),
  })

  const config = await getConfig()
  if (!config.walg_access_key || !config.walg_secret_key) throw new Error('Backup credentials are missing from the platform config')
  await writeSecretOnce(walgVaultPath(db.id), {
    access_key: config.walg_access_key,
    secret_key: config.walg_secret_key,
  })

  return readAdminCredentials(db.id)
}

async function restoreIntoVolume(
  db: DatabaseSpec,
  driver: ReturnType<typeof getDriver>,
  restore: { sourceId: string; backup: string; target: string },
): Promise<void> {
  const jobId = restoreJobId(db.id)
  if ((await listJobAllocations(databaseJobId(db.id))).length > 0) return

  const walg = await readSecret(walgVaultPath(db.id))
  if (!walg?.access_key || !walg?.secret_key) throw new Error('Backup credentials are missing')
  await writeSecret(backupSecretPath(jobId), { access_key: walg.access_key, secret_key: walg.secret_key })
  try {
    await stopJobById(jobId, true)
    await submitJobSpec(buildRestoreJobSpec(db, driver, backupPrefix(restore.sourceId), restore.backup, restore.target))
    await waitFor(async () => {
      const allocs = await listJobAllocations(jobId)
      return allocs.length > 0 && allocs.every((alloc) => TERMINAL.includes(alloc.ClientStatus))
    }, RESTORE_TIMEOUT_MS, 'the backup to be restored')
    const allocs = await listJobAllocations(jobId)
    if (allocs.some((alloc) => alloc.ClientStatus !== 'complete')) throw new Error('Restoring the backup failed')
  } finally {
    await stopJobById(jobId, true).catch(() => {})
    await destroySecret(backupSecretPath(jobId)).catch(() => {})
  }
}

async function finishRestore(
  db: DatabaseSpec,
  driver: ReturnType<typeof getDriver>,
  admin: { username: string; password: string },
  source: { username: string; password: string },
): Promise<string[]> {
  const candidates = [admin, source]
  let working: { username: string; password: string } | null = null
  await waitFor(async () => {
    for (const candidate of candidates) {
      try {
        if (await driver.isRecovering(connectionFor(db, candidate))) return false
        working = candidate
        return true
      } catch {
        continue
      }
    }
    return false
  }, RESTORE_TIMEOUT_MS, 'recovery to finish')

  if (working && working !== admin) await driver.setAdminPassword(connectionFor(db, working), admin.password)
  const conn = connectionFor(db, admin)
  await driver.dropAppRoles(conn)
  await driver.allowWrites(conn)
  return [source.password]
}

export async function provisionDatabase(id: string): Promise<void> {
  const row = await getDatabase(id)
  if (!row) throw new Error(`Database ${id} not found`)
  const db = toSpec(row)
  const driver = getDriver(db.engine)
  let secrets: string[] = []

  try {
    const admin = await ensureCredentials(db, driver.adminUser)
    secrets = [admin.password]
    await updateDatabase(id, {
      nomadJobId: databaseJobId(id),
      volumePath: databaseVolumeDir(id),
      adminVaultPath: adminVaultPath(id),
    })

    const restore = row.restoreSourceId && row.restoreBackup && row.restoreTarget
      ? { sourceId: row.restoreSourceId, backup: row.restoreBackup, target: row.restoreTarget }
      : null
    if (restore) await restoreIntoVolume(db, driver, restore)

    await submitJobSpec(buildDatabaseJobSpec(db, driver))
    await waitFor(() => serviceHealthy(db.host), HEALTH_TIMEOUT_MS, `${db.host} to become healthy`)
    if (restore) {
      secrets = [...secrets, ...(await finishRestore(db, driver, admin, await readAdminCredentials(restore.sourceId)))]
    }
    await retry(() => driver.bootstrap(connectionFor(db, admin)), 10, POLL_MS)

    await updateDatabase(id, { status: 'ready', statusReason: null })
  } catch (err) {
    const reason = maskLine(err instanceof Error ? err.message : String(err), secrets).slice(0, 500)
    await updateDatabase(id, { status: 'failed', statusReason: reason })
    throw new Error(reason)
  }
}

async function jobFinished(jobId: string): Promise<boolean> {
  const allocs = await listJobAllocations(jobId)
  return allocs.every((alloc) => ['complete', 'failed', 'lost'].includes(alloc.ClientStatus))
}

export async function deprovisionDatabase(id: string): Promise<void> {
  const row = await getDatabase(id)
  if (!row) return
  const db = toSpec(row)

  await updateDatabase(id, { status: 'deleting', statusReason: null })
  await stopJobById(databaseJobId(id), true)
  await waitFor(() => jobFinished(databaseJobId(id)), 90_000, 'the database to stop')

  await submitJobSpec(buildCleanupJobSpec(db))
  await waitFor(async () => {
    const allocs = await listJobAllocations(cleanupJobId(id))
    return allocs.length > 0 && allocs.every((alloc) => ['complete', 'failed', 'lost'].includes(alloc.ClientStatus))
  }, 90_000, 'the data directory to be removed')
  const allocs = await listJobAllocations(cleanupJobId(id))
  await stopJobById(cleanupJobId(id), true)
  if (allocs.some((alloc) => alloc.ClientStatus !== 'complete')) throw new Error('Removing the data directory failed')

  await destroySecret(adminVaultPath(id))
  await destroySecret(walgVaultPath(id))
  await updateDatabase(id, { deletedAt: new Date() })
}
