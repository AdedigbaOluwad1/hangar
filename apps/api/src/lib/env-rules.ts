const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const RESERVED = [/^PORT$/, /^HANGAR_/, /^NOMAD_/]

export const ENV_LIMITS = { maxKeys: 100, maxKeyLength: 128, maxValueLength: 16 * 1024 } as const

export interface EnvPatch {
  set?: Record<string, string>
  unset?: string[]
}

function checkKey(key: string): string | null {
  if (key.length > ENV_LIMITS.maxKeyLength) return `${key.slice(0, 20)}…: name is longer than ${ENV_LIMITS.maxKeyLength} characters`
  if (!KEY_PATTERN.test(key)) return `${key}: names use letters, digits and underscores, and cannot start with a digit`
  if (RESERVED.some((pattern) => pattern.test(key))) return `${key}: this name is reserved by Hangar`
  return null
}

export function validateEnv(vars: Record<string, string>): string | null {
  const keys = Object.keys(vars)
  if (keys.length > ENV_LIMITS.maxKeys) return `At most ${ENV_LIMITS.maxKeys} variables are allowed`
  for (const key of keys) {
    const problem = checkKey(key)
    if (problem) return problem
    if (typeof vars[key] !== 'string') return `${key}: value must be a string`
    if (vars[key].length > ENV_LIMITS.maxValueLength) return `${key}: value is longer than ${ENV_LIMITS.maxValueLength} characters`
  }
  return null
}

export function validatePatch(patch: EnvPatch): string | null {
  const set = patch.set ?? {}
  const unset = patch.unset ?? []
  if (Object.keys(set).length === 0 && unset.length === 0) return 'Nothing to change'
  const problem = validateEnv(set)
  if (problem) return problem
  const clash = unset.find((key) => key in set)
  if (clash) return `${clash}: cannot be set and removed in the same request`
  return null
}

export function applyPatch(current: Record<string, string>, patch: EnvPatch): Record<string, string> {
  const next = { ...current, ...(patch.set ?? {}) }
  for (const key of patch.unset ?? []) delete next[key]
  return next
}
