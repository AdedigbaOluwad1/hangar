import { getVault } from './config'
import { envVaultPath } from './job-spec'
import { applyPatch, validateEnv, type EnvPatch } from './env-rules'

const MAX_ATTEMPTS = 4

export class EnvLimitError extends Error {}

function isNotFound(err: any): boolean {
  return err?.response?.statusCode === 404
}

function isCasMismatch(err: any): boolean {
  return err?.response?.statusCode === 400 && /check-and-set/i.test(String(err?.message ?? ''))
}

export async function readEnv(deploymentId: string): Promise<{ vars: Record<string, string>; version: number }> {
  try {
    const result = await getVault().read(envVaultPath(deploymentId))
    return { vars: result?.data?.data ?? {}, version: result?.data?.metadata?.version ?? 0 }
  } catch (err) {
    if (isNotFound(err)) return { vars: {}, version: 0 }
    throw err
  }
}

export async function listEnvKeys(deploymentId: string): Promise<string[]> {
  const { vars } = await readEnv(deploymentId)
  return Object.keys(vars).sort()
}

export async function writeEnv(deploymentId: string, vars: Record<string, string>): Promise<void> {
  const problem = validateEnv(vars)
  if (problem) throw new EnvLimitError(problem)
  await getVault().write(envVaultPath(deploymentId), { data: vars })
}

export async function ensureEnv(deploymentId: string): Promise<void> {
  const { version } = await readEnv(deploymentId)
  if (version > 0) return
  try {
    await getVault().write(envVaultPath(deploymentId), { options: { cas: 0 }, data: {} })
  } catch (err) {
    if (!isCasMismatch(err)) throw err
  }
}

export async function patchEnv(deploymentId: string, patch: EnvPatch): Promise<string[]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { vars, version } = await readEnv(deploymentId)
    const next = applyPatch(vars, patch)
    const problem = validateEnv(next)
    if (problem) throw new EnvLimitError(problem)
    try {
      await getVault().write(envVaultPath(deploymentId), { options: { cas: version }, data: next })
      return Object.keys(next).sort()
    } catch (err) {
      if (!isCasMismatch(err) || attempt === MAX_ATTEMPTS) throw err
    }
  }
  throw new Error('unreachable')
}
