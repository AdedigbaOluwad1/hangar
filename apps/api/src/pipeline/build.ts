import { execa } from 'execa'
import { join } from 'path'
import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'

export async function build(
  deploymentId: string,
  dir: string,
): Promise<string> {
  const registryHost = process.env.REGISTRY_HOST ?? 'registry.hangar.local:5000'
  const registryTag = `${registryHost}/hangar-${deploymentId}:latest`
  const pullTag = registryTag
  const planPath = join(dir, 'railpack-plan.json')

  // step 1 — prepare
  await writeLog(deploymentId, 'build', `📋 Analysing app...`)
  await emitLog(deploymentId, 'build', `📋 Analysing app...`)
  const prepareProc = execa('railpack', ['prepare', dir, '--plan-out', planPath])
  prepareProc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })
  prepareProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })
  await prepareProc

  // step 2 — build and push directly to local registry
  await writeLog(deploymentId, 'build', `🔨 Building image ${registryTag}`)
  await emitLog(deploymentId, 'build', `🔨 Building image ${registryTag}`)
  const buildProc = execa('buildctl', [
    '--addr', process.env.BUILDKIT_HOST!,
    'build',
    '--local', `context=${dir}`,
    '--local', `dockerfile=${dir}`,
    '--frontend=gateway.v0',
    '--opt', 'source=ghcr.io/railwayapp/railpack-frontend',
    '--output', `type=image,name=${registryTag},push=true`,
  ])
  buildProc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })
  buildProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })
  await buildProc

  await writeLog(deploymentId, 'build', `✅ Image pushed: ${registryTag}`)
  await emitLog(deploymentId, 'build', `✅ Image pushed: ${registryTag}`)
  return pullTag
}