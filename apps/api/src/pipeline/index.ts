import { rm } from 'fs/promises'
import { updateDeployment, writeLog } from '@hangar/db'
import { clone } from './clone'
import { build } from './build'
import { runContainer } from './run'
import { patchCaddy, unpatchCaddy } from './caddy'
import { emitDone, emitLog } from '../lib/emitter'
import { stopJob } from '../lib/nomad'

export async function runPipeline(
  deploymentId: string,
  options: {
    resources?: { cpu?: number; memoryMb?: number }
    previousDeploymentId?: string
  } = {}
) {
  let dir: string | undefined
  try {
    await updateDeployment(deploymentId, { status: 'building' })
    dir = await clone(deploymentId)
    const imageTag = await build(deploymentId, dir)
    await updateDeployment(deploymentId, { imageTag })
    await updateDeployment(deploymentId, { status: 'deploying' })
    const { containerId } = await runContainer(deploymentId, imageTag, options.resources)
    await updateDeployment(deploymentId, { containerId })
    const liveUrl = await patchCaddy(deploymentId)
    await updateDeployment(deploymentId, { liveUrl, status: 'running' })
    await emitLog(deploymentId, 'system', '✅ Deployment complete')

    // New deployment is live — now tear down the previous one
    if (options.previousDeploymentId) {
      const prevId = options.previousDeploymentId
      try { await stopJob(prevId) } catch { /* already stopped */ }
      try { await unpatchCaddy(prevId) } catch { /* route may not exist */ }
      await updateDeployment(prevId, { status: 'stopped' })
    }
  } catch (err: any) {
    console.error('Pipeline error:', err)
    await writeLog(deploymentId, 'system', `❌ Pipeline failed: ${err.message}`)
    await updateDeployment(deploymentId, { status: 'failed' })
  } finally {
    await emitDone(deploymentId)
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => { })
    }
  }
}