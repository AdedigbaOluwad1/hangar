import { rm } from 'fs/promises'
import { updateDeployment, updateBuild, stopPreviousBuilds } from '@hangar/db'
import { clone } from './clone'
import { build } from './build'
import { runContainer } from './run'
import { patchCaddy, unpatchCaddy } from './caddy'
import { emitDone, forgetBuildSecrets, maskForBuild, stopJob, trackBuildSecrets, writeLog } from '../lib'
import { PIPELINE_LOG } from '@hangar/types'

export async function runPipeline(
  deploymentId: string,
  buildId: string,
  options: {
    resources?: { cpu?: number; memoryMb?: number }
    rollbackImageTag?: string
    restartImageTag?: string
  } = {}
) {
  let dir: string | undefined
  try {
    await trackBuildSecrets(deploymentId, buildId)
    let imageTag: string

    const reusedImageTag = options.rollbackImageTag ?? options.restartImageTag
    if (reusedImageTag) {
      imageTag = reusedImageTag
      await updateBuild(buildId, { status: 'deploying', imageTag })
      const marker = options.rollbackImageTag ? `⏪ ${PIPELINE_LOG.rollback}` : `🔄 ${PIPELINE_LOG.restart}`
      await writeLog(buildId, 'system', `${marker}: ${imageTag}`)
    } else {
      await updateBuild(buildId, { status: 'building' })
      dir = await clone(deploymentId, buildId)
      imageTag = await build(deploymentId, buildId, dir)
      await updateBuild(buildId, { status: 'deploying', imageTag })
    }

    try { await stopJob(deploymentId) } catch { }
    try { await unpatchCaddy(deploymentId) } catch { }

    const { containerId } = await runContainer(deploymentId, buildId, imageTag, options.resources)
    await updateDeployment(deploymentId, { containerId, imageTag, status: 'running' })
    const liveUrl = await patchCaddy(deploymentId, buildId)
    await updateDeployment(deploymentId, { liveUrl })
    await stopPreviousBuilds(deploymentId, buildId)
    await updateBuild(buildId, { status: 'running' })
    await writeLog(buildId, 'system', `✅ ${PIPELINE_LOG.complete}`)
  } catch (err: any) {
    console.error('Pipeline error:', maskForBuild(buildId, String(err?.stack ?? err)))
    await writeLog(buildId, 'system', `❌ ${PIPELINE_LOG.failed}: ${err.message}`)
    await updateDeployment(deploymentId, { status: 'failed' })
    await updateBuild(buildId, { status: 'failed' })
  } finally {
    await emitDone(buildId)
    forgetBuildSecrets(buildId)
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => { })
    }
  }
}