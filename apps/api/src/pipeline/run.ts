import { submitJob, getUserEnv, writeLog } from '../lib'
import { PIPELINE_LOG } from '@hangar/types'

export async function runContainer(
  deploymentId: string,
  buildId: string,
  imageTag: string,
  resources: { cpu?: number; memoryMb?: number } = {},
): Promise<{ containerId: string }> {
  await writeLog(buildId, 'deploy', `🐳 ${PIPELINE_LOG.schedule}`)
  const userEnv = await getUserEnv(deploymentId)
  const result = await submitJob(deploymentId, imageTag, userEnv, resources)
  await writeLog(buildId, 'deploy', `✅ ${PIPELINE_LOG.scheduled}: ${result.EvalID}`)
  return { containerId: result.EvalID }
}