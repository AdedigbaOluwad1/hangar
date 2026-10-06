import test from 'node:test'
import assert from 'node:assert/strict'
import { DATABASE_PLANS } from '@hangar/types'
import { getDriver } from './driver'
import { postgresDriver, quoteIdentifier } from './postgres'
import { attachmentEnv, attachmentEnvKeys, connectionUrl, envPrefix } from './env'
import { extractStdout, parseBackupList } from './backup-list'
import { chooseRestore } from './restore-plan'
import { buildBackupJobSpec, buildRestoreJobSpec, buildCleanupJobSpec, buildDatabaseJobSpec, planResources, quotaHeadroomMb, quotaLimits } from './job'
import { checkCapacity, resolveRequest } from './admission'
import { adminVaultPath, databaseFqdn, databaseHost, databaseJobId, databaseVolumeDir, walgVaultPath } from './names'

const db = {
  id: 'db-abc12345',
  callsign: 'amber-heron',
  engine: 'postgres' as const,
  version: '16',
  plan: 'small',
  host: databaseHost('amber-heron'),
  port: 5432,
  storageGb: 5,
  projectId: 1007,
}
const spec = buildDatabaseJobSpec(db, postgresDriver)
const [prepare, main] = spec.Job.TaskGroups[0].Tasks as [any, any]

test('names a database after its id and callsign', () => {
  assert.equal(databaseJobId(db.id), 'hangar-db-abc12345')
  assert.equal(db.host, 'db-amber-heron')
  assert.equal(databaseFqdn(db.host), 'db-amber-heron.service.consul')
  assert.equal(adminVaultPath(db.id), 'hangar/data/databases/hangar-db-abc12345/admin')
  assert.equal(walgVaultPath(db.id), 'hangar/data/databases/hangar-db-abc12345/walg')
  assert.match(databaseVolumeDir(db.id), /\/db-abc12345$/)
})

test('prepares the volume with its quota before the engine starts', () => {
  assert.equal(prepare.Driver, 'raw_exec')
  assert.deepEqual(prepare.Lifecycle, { Hook: 'prestart', Sidecar: false })
  assert.equal(prepare.Config.command, '/usr/local/bin/hangar-db-quota')
  assert.deepEqual(prepare.Config.args, ['set', databaseVolumeDir(db.id), '1007', '5632m', '4096m', '--owner', '70:70'])
})

test('runs the engine privately with secrets only from its own Vault paths', () => {
  assert.equal(spec.Job.ID, 'hangar-db-abc12345')
  assert.equal(main.Driver, 'podman')
  assert.equal(main.Vault.Role, 'nomad-databases')
  assert.equal(main.Vault.Env, false)
  assert.equal(main.Vault.DisableFile, true)
  assert.equal('ports' in main.Config, false)
  assert.deepEqual(main.Config.volumes, [`${databaseVolumeDir(db.id)}:/var/lib/postgresql/data`])
  const template = main.Templates[0].EmbeddedTmpl
  assert.ok(template.includes(`"${adminVaultPath(db.id)}"`) && template.includes(`"${walgVaultPath(db.id)}"`))
  assert.equal(template.includes('hangar/data/config'), false)
  assert.equal(JSON.stringify(main.Env).includes('PASSWORD'), false)
  assert.equal(JSON.stringify(main.Env).includes('SECRET'), false)
})

test('registers the database in Consul without publishing a host port', () => {
  const [service] = main.Services
  assert.equal(service.Name, 'db-amber-heron')
  assert.equal(service.AddressMode, 'driver')
  assert.equal(service.PortLabel, '5432')
  assert.equal(service.Checks[0].Type, 'tcp')
  assert.ok(main.KillTimeout >= 30_000_000_000)
})

test('sizes the engine and its quota from the plan', () => {
  assert.deepEqual(main.Resources, { CPU: DATABASE_PLANS.small.cpu, MemoryMB: DATABASE_PLANS.small.memoryMb })
  assert.deepEqual(planResources('large'), { cpu: 1000, memoryMb: 2048 })
  assert.throws(() => planResources('huge'), /Unknown plan/)
  assert.deepEqual(quotaLimits(20), { hard: '22528m', soft: '16384m' })
  assert.deepEqual(quotaLimits(1), { hard: '1536m', soft: '819m' })
  assert.equal(quotaHeadroomMb(1), 512)
  assert.equal(quotaHeadroomMb(50), 5120)
  assert.ok(main.Config.args.includes('shared_buffers=128MB'))
})

test('archives WAL to a prefix of its own', () => {
  assert.equal(main.Env.WALG_S3_PREFIX, 's3://hangar-backups/databases/db-abc12345')
  assert.ok(main.Config.args.includes('archive_mode=on'))
})

test('the cleanup job only purges this database', () => {
  const cleanup = buildCleanupJobSpec(db)
  assert.equal(cleanup.Job.Type, 'batch')
  assert.equal(cleanup.Job.ID, 'hangar-cleanup-db-abc12345')
  assert.deepEqual(cleanup.Job.TaskGroups[0].Tasks[0].Config.args, ['purge', databaseVolumeDir(db.id), '1007'])
})

test('only engines with a driver can be provisioned', () => {
  assert.equal(getDriver('postgres'), postgresDriver)
  assert.throws(() => getDriver('mysql'), /not supported yet/)
})

test('role names are checked before they reach SQL', () => {
  assert.equal(quoteIdentifier('a_x1'), '"a_x1"')
  for (const bad of ['', 'A', '1abc', 'a-b', 'a"; drop role x; --', 'x'.repeat(64)]) {
    assert.throws(() => quoteIdentifier(bad), /Invalid role name/, bad)
  }
})

test('builds connection URLs that survive awkward passwords', () => {
  const url = connectionUrl('postgres', { host: 'h', port: 5432 }, { username: 'a_x', password: 'p@ss/w:rd?#' }, 'app')
  assert.equal(url, 'postgresql://a_x:p%40ss%2Fw%3Ard%3F%23@h:5432/app')
  assert.equal(new URL(url).password, 'p%40ss%2Fw%3Ard%3F%23')
  assert.equal(decodeURIComponent(new URL(url).password), 'p@ss/w:rd?#')
})

test('names the component variables after the URL variable', () => {
  assert.equal(envPrefix('DATABASE_URL'), 'DATABASE')
  assert.equal(envPrefix('MONGODB_URI'), 'MONGODB')
  assert.equal(envPrefix('ANALYTICS'), 'ANALYTICS')
  const env = attachmentEnv('postgres', 'ANALYTICS_URL', { host: 'db-x.service.consul', port: 5432 }, { username: 'a_1', password: 'pw' }, 'app')
  assert.deepEqual(Object.keys(env).sort(), ['ANALYTICS_HOST', 'ANALYTICS_NAME', 'ANALYTICS_PASSWORD', 'ANALYTICS_PORT', 'ANALYTICS_URL', 'ANALYTICS_USER'])
  assert.equal(env.ANALYTICS_PORT, '5432')
})

test('valkey also gets VALKEY_URL, but only under its default name, and redis has no database name', () => {
  const role = { username: 'a_1', password: 'pw' }
  const conn = { host: 'h', port: 6379 }
  const withDefault = attachmentEnv('valkey', 'REDIS_URL', conn, role, null)
  assert.equal(withDefault.VALKEY_URL, withDefault.REDIS_URL)
  assert.equal('REDIS_NAME' in withDefault, false)
  assert.equal('VALKEY_URL' in attachmentEnv('valkey', 'CACHE_URL', conn, role, null), false)
})

test('checks a request against the engine and plan rules', () => {
  assert.deepEqual(resolveRequest({ engine: 'postgres', plan: 'small' }), { version: '16', plan: 'small' })
  assert.match((resolveRequest({ engine: 'postgres', version: '9', plan: 'small' }) as { error: string }).error, /not available/)
  assert.match((resolveRequest({ engine: 'postgres', plan: 'huge' }) as { error: string }).error, /Unknown plan/)
  assert.match((resolveRequest({ engine: 'ferretdb', plan: 'small' }) as { error: string }).error, /at least the Medium plan/)
  assert.deepEqual(resolveRequest({ engine: 'ferretdb', plan: 'large' }), { version: '2', plan: 'large' })
})

test('refuses a database that would not fit on the volume', () => {
  assert.equal(checkCapacity(10, 5, 20), null)
  assert.equal(checkCapacity(13, 5, 20), null)
  assert.match(checkCapacity(14, 5, 20)!, /5 GB requested, 4 GB free of 18 GB/)
  assert.equal(checkCapacity(100, 50, null), null)
})

test('lists the variables an attachment manages so detach removes exactly those', () => {
  const conn = { host: 'db-x.service.consul', port: 5432 }
  const role = { username: 'a_1', password: 'pw' }
  const keys = attachmentEnvKeys('postgres', 'DATABASE_URL', 'app')
  assert.deepEqual(keys.sort(), Object.keys(attachmentEnv('postgres', 'DATABASE_URL', conn, role, 'app')).sort())
  assert.ok(keys.includes('DATABASE_NAME'))
  assert.ok(!attachmentEnvKeys('valkey', 'CACHE_URL', null).includes('CACHE_NAME'))
})

test('reads the newest backup out of wal-g backup-list output', () => {
  const out = `INFO: noise\n[{"backup_name":"base_1","start_time":"2026-10-05T02:00:00Z","finish_time":"2026-10-05T02:01:00Z","compressed_size":100},{"backup_name":"base_2","start_time":"2026-10-06T02:00:00Z","finish_time":"2026-10-06T02:01:00Z","compressed_size":250}]\n`
  const parsed = parseBackupList(out)
  assert.equal(parsed?.name, 'base_2')
  assert.equal(parsed?.sizeBytes, 250)
  assert.equal(parsed?.finishedAt?.toISOString(), '2026-10-06T02:01:00.000Z')
  assert.equal(parseBackupList('[]'), null)
  assert.equal(parseBackupList('no json here'), null)
})

test('runs the backup as a one-shot job on the database volume, read-only, with its own secret path', () => {
  const job = buildBackupJobSpec(db, postgresDriver, 'bak-0123456789').Job
  const task = job.TaskGroups[0].Tasks[0] as any
  assert.match(job.ID, /^hangar-db-abc12345-bak-/)
  assert.equal(job.Type, 'batch')
  assert.deepEqual(task.Config.volumes, [`${databaseVolumeDir(db.id)}:/var/lib/postgresql/data:ro`])
  assert.equal(task.Env.PGHOST, databaseFqdn(db.host))
  assert.ok(task.Templates[0].EmbeddedTmpl.includes(`hangar/data/databases/${job.ID}/backup`))
  assert.match(task.Config.args[1], /--confirm/)
  for (const key of ['PGPASSWORD', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) assert.equal(key in task.Env, false)
})

const backupRows = [
  { id: 'b1', status: 'completed', s3Key: 'base_1', restorableFrom: new Date('2026-10-04T02:01:00Z'), startedAt: new Date('2026-10-04T02:00:00Z') },
  { id: 'b2', status: 'completed', s3Key: 'base_2', restorableFrom: new Date('2026-10-05T02:01:00Z'), startedAt: new Date('2026-10-05T02:00:00Z') },
  { id: 'b3', status: 'failed', s3Key: null, restorableFrom: null, startedAt: new Date('2026-10-06T02:00:00Z') },
]
const noon = new Date('2026-10-06T12:00:00Z')

test('picks the base backup and recovery target for a restore', () => {
  assert.deepEqual(chooseRestore(backupRows, {}, true, noon), { backup: 'base_2', target: 'latest' })
  assert.deepEqual(chooseRestore(backupRows, { backupId: 'b1' }, false, noon), { backup: 'base_1', target: 'immediate' })
  assert.deepEqual(
    chooseRestore(backupRows, { time: new Date('2026-10-04T20:00:00Z') }, true, noon),
    { backup: 'base_1', target: '2026-10-04T20:00:00.000Z' },
  )
  assert.deepEqual(
    chooseRestore(backupRows, { time: new Date('2026-10-05T10:00:00Z') }, true, noon),
    { backup: 'base_2', target: '2026-10-05T10:00:00.000Z' },
  )
})

test('refuses restores it cannot honour', () => {
  assert.ok('error' in chooseRestore(backupRows, { time: new Date('2026-10-03T00:00:00Z') }, true, noon))
  assert.ok('error' in chooseRestore(backupRows, { time: new Date('2026-10-07T00:00:00Z') }, true, noon))
  assert.ok('error' in chooseRestore(backupRows, { time: noon }, false, noon))
  assert.ok('error' in chooseRestore(backupRows, { backupId: 'b3' }, true, noon))
  assert.ok('error' in chooseRestore(backupRows, { backupId: 'b1', time: noon }, true, noon))
  assert.ok('error' in chooseRestore([], {}, true, noon))
})

test('restores into the new volume with the source archive and a recovery target', () => {
  const source = 's3://hangar-backups/databases/db-src00001'
  const script = postgresDriver.restoreScript(source, 'base_000000010000000000000004', '2026-10-05T10:00:00.000Z')
  assert.match(script, /^wal-g backup-fetch \/var\/lib\/postgresql\/data base_000000010000000000000004 && /)
  assert.ok(script.endsWith('touch /var/lib/postgresql/data/recovery.signal'))
  const conf = Buffer.from(script.match(/echo (\S+) \|/)![1], 'base64').toString()
  assert.ok(conf.includes(`WALG_S3_PREFIX=${source} wal-g wal-fetch`))
  assert.ok(conf.includes("recovery_target_time = '2026-10-05 10:00:00.000+00'"))
  assert.throws(() => postgresDriver.restoreScript(source, 'x; rm -rf /', 'latest'))
  assert.throws(() => postgresDriver.restoreScript(source, 'base_1', "now'; drop"))

  const job = buildRestoreJobSpec(db, postgresDriver, source, 'base_1', 'latest').Job
  const [prepare, restore] = job.TaskGroups[0].Tasks as [any, any]
  assert.equal(job.Type, 'batch')
  assert.deepEqual(prepare.Lifecycle, { Hook: 'prestart', Sidecar: false })
  assert.equal(restore.Env.WALG_S3_PREFIX, source)
  assert.deepEqual(restore.Config.volumes, [`${databaseVolumeDir(db.id)}:/var/lib/postgresql/data`])
  assert.ok(restore.Templates[0].EmbeddedTmpl.includes(`hangar/data/databases/${job.ID}/backup`))
})

test('reads wal-g output out of the container log framing', () => {
  const raw = [
    '2026-10-06T12:56:27.18+00:00 stderr F INFO: 2026/10/06 Backup will be pushed to storage: default',
    '2026-10-06T12:56:28.10+00:00 stdout F [{"backup_name":"base_000000010000000000000004","start_time":"2026-10-06T12:56:27Z","finish_time":"2026-10-06T12:56:28Z","compressed_size":4096}]',
    '',
  ].join('\n')
  assert.equal(extractStdout(raw).trim().startsWith('[{"backup_name"'), true)
  const parsed = parseBackupList(raw)
  assert.equal(parsed?.name, 'base_000000010000000000000004')
  assert.equal(parsed?.sizeBytes, 4096)
})
