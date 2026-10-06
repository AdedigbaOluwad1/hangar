import test from 'node:test'
import assert from 'node:assert/strict'
import { DATABASE_PLANS } from '@hangar/types'
import { getDriver } from './driver'
import { postgresDriver, quoteIdentifier } from './postgres'
import { attachmentEnv, connectionUrl, envPrefix } from './env'
import { buildCleanupJobSpec, buildDatabaseJobSpec, planResources, quotaHeadroomMb, quotaLimits } from './job'
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
