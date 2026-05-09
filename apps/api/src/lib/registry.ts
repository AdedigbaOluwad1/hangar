import { isBuildTagInUse } from "@hangar/db"

const REGISTRY_KEEP = 3

export async function gcOldTags(registryHost: string, deploymentId: string): Promise<void> {
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
    // skip if any build still references this tag
    if (await isBuildTagInUse(tag)) continue

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

export async function getAvailableTags(registryHost: string, deploymentId: string): Promise<string[]> {
  const res = await fetch(`http://${registryHost}/v2/hangar-${deploymentId}/tags/list`)
  if (!res.ok) return []

  const { tags } = await res.json() as { tags: string[] | null }
  if (!tags) return []

  return tags
    .filter(t => t !== 'latest' && t !== 'cache')
    .sort()
    .reverse()
    .slice(0, 3)
}

export async function tagExists(registryHost: string, deploymentId: string, tag: string): Promise<boolean> {
  const res = await fetch(
    `http://${registryHost}/v2/hangar-${deploymentId}/manifests/${tag}`,
    { headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' } }
  )
  return res.ok
}