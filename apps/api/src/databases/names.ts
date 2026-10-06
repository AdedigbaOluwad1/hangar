const VOLUME = process.env.HANGAR_DB_VOLUME ?? '/opt/hangar/data/databases'

export function databaseJobId(id: string): string {
  return `hangar-${id}`
}

export function databaseHost(callsign: string): string {
  return `db-${callsign}`
}

export function databaseFqdn(host: string): string {
  return `${host}.service.consul`
}

export function adminVaultPath(id: string): string {
  return `hangar/data/databases/${databaseJobId(id)}/admin`
}

export function walgVaultPath(id: string): string {
  return `hangar/data/databases/${databaseJobId(id)}/walg`
}

export function databaseVolumeDir(id: string): string {
  return `${VOLUME}/${id}`
}

export function cleanupJobId(id: string): string {
  return `hangar-cleanup-${id}`
}

export function backupPrefix(id: string): string {
  return `s3://hangar-backups/databases/${id}`
}

export function backupJobId(databaseId: string, backupId: string): string {
  return `${databaseJobId(databaseId)}-bak-${backupId.slice(-8)}`
}

export function backupSecretPath(jobId: string): string {
  return `hangar/data/databases/${jobId}/backup`
}

export function restoreJobId(id: string): string {
  return `${databaseJobId(id)}-restore`
}
