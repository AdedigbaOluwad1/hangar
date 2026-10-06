import { Client } from 'pg'
import type { DatabaseConnection, DatabaseDriver, DatabaseSpec, RoleCredentials } from './driver'
import { backupPrefix } from './names'

const APP_DATABASE = 'app'
const OWNER_ROLE = 'app_owner'
const ADMIN_USER = 'hangar_admin'
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/

export function quoteIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`Invalid role name: ${name}`)
  return `"${name}"`
}

async function withClient<T>(conn: DatabaseConnection, database: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database,
    connectionTimeoutMillis: 8000,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end().catch(() => {})
  }
}

async function roleExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name])
  return (result.rowCount ?? 0) > 0
}

export const postgresDriver: DatabaseDriver = {
  engine: 'postgres',
  adminUser: ADMIN_USER,
  appDatabase: APP_DATABASE,
  dataPath: '/var/lib/postgresql/data',
  dataOwner: '70:70',

  image(version) {
    const registry = process.env.REGISTRY_HOST ?? 'registry.service.consul:5000'
    return `${registry}/hangar-postgres:${version}`
  },

  args(_db, memoryMb) {
    return [
      'postgres',
      '-c', 'archive_mode=on',
      '-c', 'archive_command=wal-g wal-push "%p"',
      '-c', 'archive_timeout=60',
      '-c', `shared_buffers=${Math.max(32, Math.floor(memoryMb / 4))}MB`,
      '-c', 'max_connections=100',
    ]
  },

  staticEnv(db: DatabaseSpec) {
    return {
      POSTGRES_USER: ADMIN_USER,
      POSTGRES_DB: 'postgres',
      WALG_S3_PREFIX: backupPrefix(db.id),
      AWS_ENDPOINT: 'http://seaweedfs.service.consul:8333',
      AWS_S3_FORCE_PATH_STYLE: 'true',
      AWS_REGION: 'us-east-1',
    }
  },

  envTemplate(adminPath, walgPath) {
    return [
      `{{ with secret "${adminPath}" }}`,
      'POSTGRES_PASSWORD={{ .Data.data.password | toJSON }}',
      '{{ end }}',
      `{{ with secret "${walgPath}" }}`,
      'AWS_ACCESS_KEY_ID={{ .Data.data.access_key | toJSON }}',
      'AWS_SECRET_ACCESS_KEY={{ .Data.data.secret_key | toJSON }}',
      '{{ end }}',
    ].join('\n')
  },

  backupScript(retentionDays) {
    const cutoff = `$(date -u -d @$(( $(date +%s) - ${retentionDays} * 86400 )) +%Y-%m-%dT%H:%M:%SZ)`
    return [
      'wal-g backup-push /var/lib/postgresql/data',
      `wal-g delete before FIND_FULL "${cutoff}" --confirm`,
      'wal-g backup-list --json',
    ].join(' && ')
  },

  backupEnv(db, host) {
    return {
      ...this.staticEnv(db),
      PGHOST: host,
      PGPORT: String(db.port),
      PGUSER: ADMIN_USER,
      PGDATABASE: 'postgres',
    }
  },

  backupTemplate(secretPath) {
    return [
      `{{ with secret "${secretPath}" }}`,
      'PGPASSWORD={{ .Data.data.password | toJSON }}',
      'AWS_ACCESS_KEY_ID={{ .Data.data.access_key | toJSON }}',
      'AWS_SECRET_ACCESS_KEY={{ .Data.data.secret_key | toJSON }}',
      '{{ end }}',
    ].join('\n')
  },

  async bootstrap(conn) {
    await withClient(conn, 'postgres', async (client) => {
      if (!(await roleExists(client, OWNER_ROLE))) await client.query(`CREATE ROLE ${OWNER_ROLE} NOLOGIN`)
      const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [APP_DATABASE])
      if (!found.rowCount) await client.query(`CREATE DATABASE ${APP_DATABASE} OWNER ${OWNER_ROLE}`)
      await client.query(`REVOKE ALL ON DATABASE ${APP_DATABASE} FROM PUBLIC`)
      await client.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC')
      await client.query('REVOKE CONNECT ON DATABASE template1 FROM PUBLIC')
    })
  },

  async createRole(conn, role: RoleCredentials) {
    const name = quoteIdentifier(role.username)
    await withClient(conn, 'postgres', async (client) => {
      const password = client.escapeLiteral(role.password)
      if (await roleExists(client, role.username)) {
        await client.query(`ALTER ROLE ${name} LOGIN PASSWORD ${password}`)
        await client.query(`GRANT ${OWNER_ROLE} TO ${name}`)
      } else {
        await client.query(`CREATE ROLE ${name} LOGIN PASSWORD ${password} IN ROLE ${OWNER_ROLE}`)
      }
      await client.query(`ALTER ROLE ${name} SET role = '${OWNER_ROLE}'`)
      await client.query(`GRANT CONNECT ON DATABASE ${APP_DATABASE} TO ${name}`)
    })
  },

  async rotateRole(conn, role) {
    const name = quoteIdentifier(role.username)
    await withClient(conn, 'postgres', async (client) => {
      await client.query(`ALTER ROLE ${name} PASSWORD ${client.escapeLiteral(role.password)}`)
    })
  },

  async restrictWrites(conn) {
    await withClient(conn, 'postgres', async (client) => {
      await client.query(`ALTER DATABASE ${APP_DATABASE} SET default_transaction_read_only = on`)
      await client.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND usename <> $2 AND pid <> pg_backend_pid()',
        [APP_DATABASE, ADMIN_USER],
      )
    })
  },

  async allowWrites(conn) {
    await withClient(conn, 'postgres', async (client) => {
      await client.query(`ALTER DATABASE ${APP_DATABASE} RESET default_transaction_read_only`)
    })
  },

  async dropRole(conn, username) {
    const name = quoteIdentifier(username)
    await withClient(conn, 'postgres', async (client) => {
      if (!(await roleExists(client, username))) return
      await client.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1', [username])
    })
    await withClient(conn, APP_DATABASE, async (client) => {
      if (!(await roleExists(client, username))) return
      await client.query(`REASSIGN OWNED BY ${name} TO ${OWNER_ROLE}`)
      await client.query(`DROP OWNED BY ${name}`)
    })
    await withClient(conn, 'postgres', async (client) => {
      await client.query(`DROP ROLE IF EXISTS ${name}`)
    })
  },
}
