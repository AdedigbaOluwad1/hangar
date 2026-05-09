import { execa } from 'execa'
import { join } from 'path'
import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'

const REGISTRY_KEEP = 3

async function gcOldTags(registryHost: string, deploymentId: string): Promise<void> {
  const name = `hangar-${deploymentId}`
  const base = `http://${registryHost}/v2/${name}`

  const res = await fetch(`${base}/tags/list`)
  if (!res.ok) return // no tags yet — first build

  const { tags } = await res.json() as { tags: string[] | null }
  if (!tags) return

  // versioned tags are uuidv7s — sort ascending (oldest first), exclude 'latest' and 'cache'
  const versioned = tags
    .filter(t => t !== 'latest' && t !== 'cache')
    .sort() // uuidv7 is lexicographically time-ordered

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
  const version = buildId  // buildId is already a uuidv7
  const name = `hangar-${deploymentId}`
  const versionedTag = `${registryHost}/${name}:${version}`
  const latestTag = `${registryHost}/${name}:latest`
  const cacheTag = `${registryHost}/${name}:cache`
  const planPath = join(dir, 'railpack-plan.json')

  // step 1 — prepare
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

  // step 2 — GC old versioned tags (keep last REGISTRY_KEEP)
  await gcOldTags(registryHost, deploymentId)

  // step 3 — build, push versioned + latest, import/export cache
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

  // return the versioned tag — this is what gets stored in DB as imageTag
  return versionedTag
}