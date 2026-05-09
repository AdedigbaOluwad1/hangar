import { execa } from 'execa'
import { join } from 'path'
import { writeLog } from '@hangar/db'
import { emitLog, gcOldTags } from '../lib'

export async function build(
  deploymentId: string,
  buildId: string,
  dir: string,
): Promise<string> {
  const registryHost = process.env.REGISTRY_HOST ?? 'registry.hangar.local:5000'
  const name = `hangar-${deploymentId}`
  const versionedTag = `${registryHost}/${name}:${buildId}`
  const latestTag = `${registryHost}/${name}:latest`
  const cacheTag = `${registryHost}/${name}:cache`
  const planPath = join(dir, 'railpack-plan.json')

  await writeLog(buildId, 'build', `📋 Analysing app...`)
  await emitLog(buildId, 'build', `📋 Analysing app...`)
  const prepareProc = execa('railpack', ['prepare', dir, '--plan-out', planPath])
  prepareProc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })
  prepareProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })
  await prepareProc

  await gcOldTags(registryHost, deploymentId)

  await writeLog(buildId, 'build', `🔨 Building image ${versionedTag}`)
  await emitLog(buildId, 'build', `🔨 Building image ${versionedTag}`)
  const buildProc = execa('buildctl', [
    '--addr', process.env.BUILDKIT_HOST!,
    'build',
    '--local', `context=${dir}`,
    '--local', `dockerfile=${dir}`,
    '--frontend=gateway.v0',
    '--opt', 'source=ghcr.io/railwayapp/railpack-frontend',
    '--output', `type=image,name=${versionedTag},push=true`,
    '--output', `type=image,name=${latestTag},push=true`,
    '--export-cache', `type=registry,ref=${cacheTag},mode=max`,
    '--import-cache', `type=registry,ref=${cacheTag}`,
  ])
  buildProc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })
  buildProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })
  await buildProc

  await writeLog(buildId, 'build', `✅ Image pushed: ${versionedTag}`)
  await emitLog(buildId, 'build', `✅ Image pushed: ${versionedTag}`)

  return versionedTag
}