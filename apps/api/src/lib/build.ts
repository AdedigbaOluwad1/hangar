import { execa } from 'execa'
import { join } from 'path'
import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'
import { PIPELINE_LOG } from '@hangar/types'

const REGISTRY_KEEP = 3

async function gcOldTags(registryHost: string, deploymentId: string): Promise<void> {
  const name = `hangar-${deploymentId}`
  const base = `http://${registryHost}/v2/${name}`

  const res = await fetch(`${base}/tags/list`)
  if (!res.ok) return

  const { tags } = await res.json() as { tags: string[] | null }
  if (!tags) return

  const versioned = tags
    .filter(t => t !== 'latest' && t !== 'cache')
    .sort()

  const toDelete = versioned.slice(0, Math.max(0, versioned.length - REGISTRY_KEEP))

  for (const tag of toDelete) {
    const headRes = await fetch(`${base}/manifests/${tag}`, {
      headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' },
    })
    if (!headRes.ok) continue

    const digest = headRes.headers.get('Docker-Content-Digest')
    if (!digest) continue

    const delRes = await fetch(`${base}/manifests/${digest}`, { method: 'DELETE' })
    if (!delRes.ok && delRes.status !== 404) {
      console.warn(`[gc] Failed to delete ${name}:${tag} (${digest}): ${delRes.status}`)
    }
  }
}

export async function build(
  deploymentId: string,
  buildId: string,
  dir: string,
): Promise<string> {
  const registryHost = process.env.REGISTRY_HOST ?? 'registry.hangar.local:5000'
  const version = buildId
  const name = `hangar-${deploymentId}`
  const versionedTag = `${registryHost}/${name}:${version}`
  const latestTag = `${registryHost}/${name}:latest`
  const cacheTag = `${registryHost}/${name}:cache`
  const planPath = join(dir, 'railpack-plan.json')

  await writeLog(buildId, 'build', `📋 ${PIPELINE_LOG.detect}...`)
  await emitLog(buildId, 'build', `📋 ${PIPELINE_LOG.detect}...`)
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

  await writeLog(buildId, 'build', `🔨 ${PIPELINE_LOG.build} ${versionedTag}`)
  await emitLog(buildId, 'build', `🔨 ${PIPELINE_LOG.build} ${versionedTag}`)
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

  await writeLog(buildId, 'build', `✅ ${PIPELINE_LOG.push}: ${versionedTag}`)
  await emitLog(buildId, 'build', `✅ ${PIPELINE_LOG.push}: ${versionedTag}`)

  return versionedTag
}