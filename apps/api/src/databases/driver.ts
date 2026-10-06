import type { DatabaseEngine } from '@hangar/types'
import { postgresDriver } from './postgres'

export interface DatabaseSpec {
  id: string
  callsign: string
  engine: DatabaseEngine
  version: string
  plan: string
  host: string
  port: number
  storageGb: number
  projectId: number
}

export interface DatabaseConnection {
  host: string
  port: number
  user: string
  password: string
}

export interface RoleCredentials {
  username: string
  password: string
}

export interface DatabaseDriver {
  engine: DatabaseEngine
  adminUser: string
  appDatabase: string | null
  dataPath: string
  dataOwner: string
  image(version: string): string
  args(db: DatabaseSpec, memoryMb: number): string[]
  staticEnv(db: DatabaseSpec): Record<string, string>
  envTemplate(adminPath: string, walgPath: string): string
  backupScript(retentionDays: number): string
  backupEnv(db: DatabaseSpec, host: string): Record<string, string>
  backupTemplate(secretPath: string): string
  bootstrap(conn: DatabaseConnection): Promise<void>
  createRole(conn: DatabaseConnection, role: RoleCredentials): Promise<void>
  rotateRole(conn: DatabaseConnection, role: RoleCredentials): Promise<void>
  dropRole(conn: DatabaseConnection, username: string): Promise<void>
  restrictWrites(conn: DatabaseConnection): Promise<void>
  allowWrites(conn: DatabaseConnection): Promise<void>
}

export function getDriver(engine: DatabaseEngine): DatabaseDriver {
  switch (engine) {
    case 'postgres':
      return postgresDriver
    default:
      throw new Error(`${engine} databases are not supported yet`)
  }
}
