// apps/api/src/pipeline/index.ts
import { rm } from 'fs/promises'
import { updateDeployment, writeLog } from '@hangar/db'
import { clone } from './clone'
import { build } from './build'
import { runContainer } from './run'
import { patchCaddy } from './caddy'
import { emitDone, emitLog } from '../lib/emitter'

export async function runPipeline(deploymentId: string) {
  let dir: string | undefined

  try {
    await updateDeployment(deploymentId, { status: 'building' })

    dir = await clone(deploymentId)
    const imageTag = await build(deploymentId, dir)
    await updateDeployment(deploymentId, { imageTag })

    await updateDeployment(deploymentId, { status: 'deploying' })
    const { containerId, port } = await runContainer(deploymentId, imageTag)
    await updateDeployment(deploymentId, { containerId, port })

    const liveUrl = await patchCaddy(deploymentId, port)
    await updateDeployment(deploymentId, { liveUrl, status: 'running' })

    await emitLog(deploymentId, 'system', '✅ Deployment complete')
  } catch (err: any) {
    await writeLog(deploymentId, 'system', `❌ Pipeline failed: ${err.message}`)
    await updateDeployment(deploymentId, { status: 'failed' })
  } finally {
    await emitDone(deploymentId)

    // clean up cloned dir
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => { })
    }
  }
}