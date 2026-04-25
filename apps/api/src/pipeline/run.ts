import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'
import { submitJob } from '../lib/nomad'

export async function runContainer(
  deploymentId: string,
  imageTag: string,
): Promise<{ containerId: string }> {
  await writeLog(deploymentId, 'deploy', `🐳 Submitting Nomad job`)
  await emitLog(deploymentId, 'deploy', `🐳 Submitting Nomad job`)

  const result = await submitJob(deploymentId, imageTag)

  await writeLog(deploymentId, 'deploy', `✅ Nomad job submitted: ${result.EvalID}`)
  await emitLog(deploymentId, 'deploy', `✅ Nomad job submitted: ${result.EvalID}`)

  return { containerId: result.EvalID }
}