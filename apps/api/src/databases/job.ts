import { DATABASE_PLANS } from '@hangar/types'
import type { DatabasePlan } from '@hangar/types'
import type { DatabaseDriver, DatabaseSpec } from './driver'
import {
  adminVaultPath,
  backupJobId,
  backupSecretPath,
  cleanupJobId,
  databaseFqdn,
  databaseJobId,
  databaseVolumeDir,
  walgVaultPath,
} from './names'

export const DATABASE_VAULT_ROLE = 'nomad-databases'
export const QUOTA_COMMAND = '/usr/local/bin/hangar-db-quota'

const SECOND = 1_000_000_000

export function planResources(plan: string): { cpu: number; memoryMb: number } {
  const known = DATABASE_PLANS[plan as DatabasePlan]
  if (!known) throw new Error(`Unknown plan: ${plan}`)
  return { cpu: known.cpu, memoryMb: known.memoryMb }
}

export function quotaHeadroomMb(storageGb: number): number {
  return Math.max(512, Math.ceil(storageGb * 1024 * 0.1))
}

export function quotaLimits(storageGb: number): { hard: string; soft: string } {
  const planMb = storageGb * 1024
  return { hard: `${planMb + quotaHeadroomMb(storageGb)}m`, soft: `${Math.floor(planMb * 0.8)}m` }
}

export function buildDatabaseJobSpec(db: DatabaseSpec, driver: DatabaseDriver) {
  const id = databaseJobId(db.id)
  const dir = databaseVolumeDir(db.id)
  const { cpu, memoryMb } = planResources(db.plan)
  const { hard, soft } = quotaLimits(db.storageGb)
  const port = String(db.port)

  return {
    Job: {
      ID: id,
      Name: id,
      Type: 'service',
      Datacenters: ['dc1'],
      TaskGroups: [
        {
          Name: 'db',
          Count: 1,
          Networks: [{ DNS: { Servers: ['10.88.0.1'] } }],
          Tasks: [
            {
              Name: 'prepare-volume',
              Driver: 'raw_exec',
              Lifecycle: { Hook: 'prestart', Sidecar: false },
              Config: {
                command: QUOTA_COMMAND,
                args: ['set', dir, String(db.projectId), hard, soft, '--owner', driver.dataOwner],
              },
              Resources: { CPU: 50, MemoryMB: 32 },
            },
            {
              Name: 'db',
              Driver: 'podman',
              KillTimeout: 30 * SECOND,
              Config: {
                image: driver.image(db.version),
                args: driver.args(db, memoryMb),
                volumes: [`${dir}:${driver.dataPath}`],
              },
              Env: driver.staticEnv(db),
              Vault: { Role: DATABASE_VAULT_ROLE, Env: false, DisableFile: true, ChangeMode: 'noop' },
              Templates: [
                {
                  EmbeddedTmpl: driver.envTemplate(adminVaultPath(db.id), walgVaultPath(db.id)),
                  DestPath: 'secrets/db.env',
                  Envvars: true,
                  ChangeMode: 'noop',
                },
              ],
              Resources: { CPU: cpu, MemoryMB: memoryMb },
              Services: [
                {
                  Name: db.host,
                  PortLabel: port,
                  AddressMode: 'driver',
                  Provider: 'consul',
                  Checks: [
                    {
                      Type: 'tcp',
                      PortLabel: port,
                      AddressMode: 'driver',
                      Interval: 10 * SECOND,
                      Timeout: 3 * SECOND,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

export function buildCleanupJobSpec(db: Pick<DatabaseSpec, 'id' | 'projectId'>) {
  const id = cleanupJobId(db.id)
  return {
    Job: {
      ID: id,
      Name: id,
      Type: 'batch',
      Datacenters: ['dc1'],
      TaskGroups: [
        {
          Name: 'cleanup',
          Count: 1,
          RestartPolicy: { Attempts: 0, Mode: 'fail' },
          ReschedulePolicy: { Attempts: 0, Unlimited: false },
          Tasks: [
            {
              Name: 'purge',
              Driver: 'raw_exec',
              Config: { command: QUOTA_COMMAND, args: ['purge', databaseVolumeDir(db.id), String(db.projectId)] },
              Resources: { CPU: 50, MemoryMB: 32 },
            },
          ],
        },
      ],
    },
  }
}

export function buildBackupJobSpec(db: DatabaseSpec, driver: DatabaseDriver, backupId: string) {
  const id = backupJobId(db.id, backupId)
  const retentionDays = DATABASE_PLANS[db.plan as DatabasePlan]?.backupRetentionDays ?? 7
  return {
    Job: {
      ID: id,
      Name: id,
      Type: 'batch',
      Datacenters: ['dc1'],
      TaskGroups: [
        {
          Name: 'backup',
          Count: 1,
          Networks: [{ DNS: { Servers: ['10.88.0.1'] } }],
          RestartPolicy: { Attempts: 0, Mode: 'fail' },
          ReschedulePolicy: { Attempts: 0, Unlimited: false },
          Tasks: [
            {
              Name: 'backup',
              Driver: 'podman',
              User: driver.dataOwner.split(':')[0],
              Config: {
                image: driver.image(db.version),
                command: '/bin/sh',
                args: ['-c', driver.backupScript(retentionDays)],
                volumes: [`${databaseVolumeDir(db.id)}:${driver.dataPath}:ro`],
              },
              Env: driver.backupEnv(db, databaseFqdn(db.host)),
              Vault: { Role: DATABASE_VAULT_ROLE, Env: false, DisableFile: true, ChangeMode: 'noop' },
              Templates: [
                {
                  EmbeddedTmpl: driver.backupTemplate(backupSecretPath(id)),
                  DestPath: 'secrets/backup.env',
                  Envvars: true,
                  ChangeMode: 'noop',
                },
              ],
              Resources: { CPU: 256, MemoryMB: 256 },
            },
          ],
        },
      ],
    },
  }
}
