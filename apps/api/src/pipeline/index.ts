// apps/api/src/pipeline/index.ts
import { updateDeployment, writeLog } from '@hangar/db';
import { clone } from './clone';
import { build } from './build';
import { runContainer } from './run';
import { patchCaddy } from './caddy';
import { emitDone, emitLog } from '../lib/emitter';

export async function runPipeline(deploymentId: string) {
  try {
    await updateDeployment(deploymentId, { status: 'building' });

    const dir = await clone(deploymentId);
    const imageTag = await build(deploymentId, dir);
    await updateDeployment(deploymentId, { imageTag });

    await updateDeployment(deploymentId, { status: 'deploying' });
    const { containerId, port } = await runContainer(deploymentId, imageTag);
    await updateDeployment(deploymentId, { containerId, port });

    const liveUrl = await patchCaddy(deploymentId, port);
    await updateDeployment(deploymentId, { liveUrl, status: 'running' });

    emitLog(deploymentId, 'system', '✅ Deployment complete');
  } catch (err: any) {
    await writeLog(deploymentId, 'system', `❌ Pipeline failed: ${err.message}`);
    await updateDeployment(deploymentId, { status: 'failed' });
  } finally {
    emitDone(deploymentId);
  }
}
