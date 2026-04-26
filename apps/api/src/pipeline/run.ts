import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'
import { submitJob } from '../lib/nomad'
import { getVault } from '../lib/config'

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
  imageTag: string,
  resources: { cpu?: number; memoryMb?: number } = {},
): Promise<{ containerId: string }> {
  await writeLog(deploymentId, 'deploy', `🐳 Submitting Nomad job`)
  await emitLog(deploymentId, 'deploy', `🐳 Submitting Nomad job`)

  const userEnv = await getUserEnv(deploymentId)
  const result = await submitJob(deploymentId, imageTag, userEnv, resources)

  await writeLog(deploymentId, 'deploy', `✅ Nomad job submitted: ${result.EvalID}`)
  await emitLog(deploymentId, 'deploy', `✅ Nomad job submitted: ${result.EvalID}`)

  return { containerId: result.EvalID }
}