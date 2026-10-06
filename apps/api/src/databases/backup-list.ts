export interface ParsedBackup {
  name: string
  sizeBytes: number | null
  finishedAt: Date | null
}

const LOG_LINE = /^\S+ (stdout|stderr) ([FP]) ?(.*)$/

export function extractStdout(raw: string): string {
  let out = ''
  let framed = false
  for (const line of raw.split('\n')) {
    const match = LOG_LINE.exec(line)
    if (!match) continue
    framed = true
    if (match[1] === 'stdout') out += match[3] + (match[2] === 'F' ? '\n' : '')
  }
  return framed ? out : raw
}

export function parseBackupList(raw: string): ParsedBackup | null {
  const stdout = extractStdout(raw)
  const start = stdout.indexOf('[')
  const end = stdout.lastIndexOf(']')
  if (start === -1 || end < start) return null
  let entries: unknown
  try {
    entries = JSON.parse(stdout.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(entries) || entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => String(a.start_time ?? a.time).localeCompare(String(b.start_time ?? b.time)))
  const latest = sorted[sorted.length - 1]
  if (typeof latest?.backup_name !== 'string') return null
  const finished = latest.finish_time ? new Date(latest.finish_time) : null
  return {
    name: latest.backup_name,
    sizeBytes: typeof latest.compressed_size === 'number' ? latest.compressed_size : null,
    finishedAt: finished && !Number.isNaN(finished.getTime()) ? finished : null,
  }
}
