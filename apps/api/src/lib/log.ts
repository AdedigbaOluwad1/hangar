import { writeLog as persistLog } from '@hangar/db'
import { emitLog } from './emitter'
import { maskLine, platformSecrets, userEnvSecrets } from './mask'
import { readEnv } from './env'

const platform = platformSecrets()
const buildSecrets = new Map<string, string[]>()

export async function trackBuildSecrets(deploymentId: string, buildId: string): Promise<void> {
  buildSecrets.set(buildId, userEnvSecrets(await readEnv(deploymentId).then((env) => env.vars, () => ({}))))
}

export function forgetBuildSecrets(buildId: string): void {
  buildSecrets.delete(buildId)
}

export function maskForBuild(buildId: string, text: string): string {
  return maskLine(text, [...platform, ...(buildSecrets.get(buildId) ?? [])])
}

export async function writeLog(
  buildId: string,
  stream: 'build' | 'deploy' | 'system',
  line: string,
): Promise<void> {
  const safe = maskForBuild(buildId, line)
  try {
    await persistLog(buildId, stream, safe)
    await emitLog(buildId, stream, safe)
  } catch (err) {
    console.error('Log write failed:', maskForBuild(buildId, err instanceof Error ? err.message : String(err)))
  }
}
