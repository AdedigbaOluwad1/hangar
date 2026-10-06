const MASK = '***'
const SENSITIVE_KEY = /(key|token|secret|password|passwd|pass|private|credential|auth|dsn)/i
const MIN_SENSITIVE_LENGTH = 4
const MIN_PLAIN_LENGTH = 8
const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi
const BEARER_TOKEN = /(\bBearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi

function urlPassword(value: string): string | null {
  try {
    const { password } = new URL(value)
    return password ? decodeURIComponent(password) : null
  } catch {
    return null
  }
}

function variants(value: string, minLength: number): string[] {
  const forms = new Set<string>()
  const add = (candidate: string) => {
    if (candidate.length >= minLength) forms.add(candidate)
  }
  add(value)
  add(encodeURIComponent(value))
  for (const line of value.split(/\r?\n/)) add(line.trim())
  const password = urlPassword(value)
  if (password) add(password)
  return [...forms]
}

export function platformSecrets(env: Record<string, string | undefined> = process.env): string[] {
  const found: string[] = []
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue
    if (SENSITIVE_KEY.test(key)) found.push(...variants(value, MIN_SENSITIVE_LENGTH))
    else {
      const password = urlPassword(value)
      if (password) found.push(...variants(password, MIN_SENSITIVE_LENGTH))
    }
  }
  return found
}

export function userEnvSecrets(env: Record<string, string>): string[] {
  const found: string[] = []
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') continue
    found.push(...variants(value, SENSITIVE_KEY.test(key) ? MIN_SENSITIVE_LENGTH : MIN_PLAIN_LENGTH))
  }
  return found
}

export function maskLine(line: string, secrets: string[]): string {
  let masked = line.replace(URL_CREDENTIALS, `$1${MASK}@`).replace(BEARER_TOKEN, `$1${MASK}`)
  const ordered = [...new Set(secrets)].sort((a, b) => b.length - a.length)
  for (const secret of ordered) masked = masked.split(secret).join(MASK)
  return masked
}
