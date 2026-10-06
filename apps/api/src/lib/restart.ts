import { uuidv7 } from 'uuidv7'
import { createBuild } from '@hangar/db'
import type { getDeployment } from '@hangar/db'
import { deployQueue } from './queue'
import { getJobResources } from './nomad'

type DeploymentWithBuild = NonNullable<Awaited<ReturnType<typeof getDeployment>>>
type Build = Awaited<ReturnType<typeof createBuild>>

export type EnvApply = 'restarted' | 'in_flight' | 'on_next_deploy'

export async function applyEnvChange(
  deployment: DeploymentWithBuild,
): Promise<{ apply: EnvApply; build: Build | null }> {
  const latest = deployment.latestBuild
  if (latest?.status === 'building' || latest?.status === 'deploying') {
    return { apply: 'in_flight', build: null }
  }
  if (deployment.status !== 'running' || latest?.status !== 'running' || !deployment.imageTag) {
    return { apply: 'on_next_deploy', build: null }
  }

  const build = await createBuild({ id: uuidv7(), deploymentId: deployment.id, trigger: 'restart' })
  await deployQueue.add('deploy', {
    deploymentId: deployment.id,
    buildId: build.id,
    resources: await getJobResources(deployment.id).catch(() => ({})),
    restartImageTag: deployment.imageTag,
  })
  return { apply: 'restarted', build }
}
