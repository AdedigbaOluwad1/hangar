import { rm } from 'fs/promises'
import { updateDeployment, updateBuild, stopPreviousBuilds, writeLog } from '@hangar/db'
import { clone } from './clone'
import { build } from './build'
import { runContainer } from './run'
import { patchCaddy, unpatchCaddy } from './caddy'
import { emitDone, emitLog } from '../lib/emitter'
import { stopJob } from '../lib/nomad'

export async function runPipeline(
  deploymentId: string,
  buildId: string,
  options: {
    resources?: { cpu?: number; memoryMb?: number }
    rollbackImageTag?: string
  } = {}
) {
  let dir: string | undefined
  try {
    let imageTag: string

    if (options.rollbackImageTag) {
      // rollback path — skip clone and build entirely
      imageTag = options.rollbackImageTag
      await updateBuild(buildId, { status: 'deploying', imageTag })
      await writeLog(buildId, 'system', `⏪ Rolling back to image: ${imageTag}`)
      await emitLog(buildId, 'system', `⏪ Rolling back to image: ${imageTag}`)
    } else {
      // normal path — clone, build, push
      await updateBuild(buildId, { status: 'building' })
      dir = await clone(deploymentId, buildId)
      imageTag = await build(deploymentId, buildId, dir)
      await updateBuild(buildId, { status: 'deploying', imageTag })
    }

    // stop current running container before starting new one (Option A — same deploymentId)
    try { await stopJob(deploymentId) } catch { /* not running */ }
    try { await unpatchCaddy(deploymentId) } catch { /* no route yet */ }

    const { containerId } = await runContainer(deploymentId, buildId, imageTag, options.resources)
    await updateDeployment(deploymentId, { containerId, imageTag, status: 'running' })
    const liveUrl = await patchCaddy(deploymentId, buildId)
    await updateDeployment(deploymentId, { liveUrl })
    await stopPreviousBuilds(deploymentId, buildId)
    await updateBuild(buildId, { status: 'running' })
    await emitLog(buildId, 'system', '✅ Deployment complete')
  } catch (err: any) {
    console.error('Pipeline error:', err)
    await writeLog(buildId, 'system', `❌ Pipeline failed: ${err.message}`)
    await updateDeployment(deploymentId, { status: 'failed' })
    await updateBuild(buildId, { status: 'failed' })
  } finally {
    await emitDone(buildId)
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => { })
    }
  }
}