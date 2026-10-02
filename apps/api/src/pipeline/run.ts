import { writeLog } from '@hangar/db'
import { submitJob, emitLog, getVault } from '../lib'
import { PIPELINE_LOG } from '@hangar/types'

async function getUserEnv(deploymentId: string): Promise<Record<string, string>> {
  try {
    const vault = getVault()
    const result = await vault.read(`hangar/data/deployments/${deploymentId}/env`)
    return result?.data?.data ?? {}
  } catch {
    return {}
  }
}

export async function runContainer(
  deploymentId: string,
  buildId: string,
  imageTag: string,
  resources: { cpu?: number; memoryMb?: number } = {},
): Promise<{ containerId: string }> {
  await writeLog(buildId, 'deploy', `🐳 ${PIPELINE_LOG.schedule}`)
  await emitLog(buildId, 'deploy', `🐳 ${PIPELINE_LOG.schedule}`)
  const userEnv = await getUserEnv(deploymentId)
  const result = await submitJob(deploymentId, imageTag, userEnv, resources)
  await writeLog(buildId, 'deploy', `✅ ${PIPELINE_LOG.scheduled}: ${result.EvalID}`)
  await emitLog(buildId, 'deploy', `✅ ${PIPELINE_LOG.scheduled}: ${result.EvalID}`)
  return { containerId: result.EvalID }
}