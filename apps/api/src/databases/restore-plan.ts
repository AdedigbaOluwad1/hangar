export interface RestorableBackup {
  id: string
  status: string
  s3Key: string | null
  restorableFrom: Date | null
  startedAt: Date
}

export interface RestoreRequest {
  backupId?: string
  time?: Date
}

export interface RestorePlan {
  backup: string
  target: string
}

export function chooseRestore(
  backups: RestorableBackup[],
  request: RestoreRequest,
  pitr: boolean,
  now: Date,
): RestorePlan | { error: string } {
  if (request.backupId && request.time) return { error: 'Choose a backup or a time, not both.' }
  const usable = backups
    .filter((b) => b.status === 'completed' && b.s3Key && b.restorableFrom)
    .sort((a, b) => b.restorableFrom!.getTime() - a.restorableFrom!.getTime())

  if (request.backupId) {
    const picked = backups.find((b) => b.id === request.backupId)
    if (!picked) return { error: 'That backup does not exist.' }
    if (picked.status !== 'completed' || !picked.s3Key) return { error: 'That backup is not complete.' }
    return { backup: picked.s3Key, target: 'immediate' }
  }

  if (request.time) {
    if (!pitr) return { error: 'This engine cannot restore to a point in time.' }
    if (request.time.getTime() > now.getTime()) return { error: 'The time is in the future.' }
    const base = usable.find((b) => b.restorableFrom!.getTime() <= request.time!.getTime())
    if (!base) return { error: 'There is no backup older than that time.' }
    return { backup: base.s3Key!, target: request.time.toISOString() }
  }

  const latest = usable[0]
  if (!latest) return { error: 'There is no completed backup to restore from.' }
  return { backup: latest.s3Key!, target: 'latest' }
}
