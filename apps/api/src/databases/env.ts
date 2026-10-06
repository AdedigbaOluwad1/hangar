import { ENGINES } from '@hangar/types'
import type { DatabaseEngine } from '@hangar/types'
import type { DatabaseConnection, RoleCredentials } from './driver'

export function envPrefix(envName: string): string {
  return envName.replace(/_(URL|URI)$/, '')
}

export function connectionUrl(
  engine: DatabaseEngine,
  conn: Pick<DatabaseConnection, 'host' | 'port'>,
  role: RoleCredentials,
  database: string | null,
): string {
  const spec = ENGINES[engine]
  const auth = `${encodeURIComponent(role.username)}:${encodeURIComponent(role.password)}`
  return `${spec.urlScheme}://${auth}@${conn.host}:${conn.port}${database ? `/${database}` : ''}`
}

export function attachmentEnv(
  engine: DatabaseEngine,
  envName: string,
  conn: Pick<DatabaseConnection, 'host' | 'port'>,
  role: RoleCredentials,
  database: string | null,
): Record<string, string> {
  const url = connectionUrl(engine, conn, role, database)
  const prefix = envPrefix(envName)
  const vars: Record<string, string> = {
    [envName]: url,
    [`${prefix}_HOST`]: conn.host,
    [`${prefix}_PORT`]: String(conn.port),
    [`${prefix}_USER`]: role.username,
    [`${prefix}_PASSWORD`]: role.password,
  }
  if (database) vars[`${prefix}_NAME`] = database
  if (envName === ENGINES[engine].defaultEnvName) {
    for (const extra of ENGINES[engine].extraEnvNames) vars[extra] = url
  }
  return vars
}
