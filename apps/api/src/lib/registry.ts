import { isBuildTagInUse } from "@hangar/db"

const REGISTRY_KEEP = 3
const MANIFEST_ACCEPT =
  'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json'

export function registryFetch(registryHost: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const { REGISTRY_USER, REGISTRY_PASSWORD } = process.env
  if (REGISTRY_USER && REGISTRY_PASSWORD) {
    headers.set('Authorization', `Basic ${Buffer.from(`${REGISTRY_USER}:${REGISTRY_PASSWORD}`).toString('base64')}`)
  }
  return fetch(`https://${registryHost}/v2/${path}`, { ...init, headers })
}

export function manifestExists(registryHost: string, name: string, ref: string): Promise<Response> {
  return registryFetch(registryHost, `${name}/manifests/${ref}`, { headers: { Accept: MANIFEST_ACCEPT } })
}

export async function gcOldTags(registryHost: string, deploymentId: string): Promise<void> {
  const name = `hangar-${deploymentId}`

  const res = await registryFetch(registryHost, `${name}/tags/list`)
  if (!res.ok) return

  const { tags } = await res.json() as { tags: string[] | null }
  if (!tags) return

  const versioned = tags
    .filter(t => t !== 'latest' && t !== 'cache')
    .sort()

  const toDelete = versioned.slice(0, Math.max(0, versioned.length - REGISTRY_KEEP))

  for (const tag of toDelete) {
    if (await isBuildTagInUse(tag)) continue

    const headRes = await manifestExists(registryHost, name, tag)
    if (!headRes.ok) continue

    const digest = headRes.headers.get('Docker-Content-Digest')
    if (!digest) continue

    const delRes = await registryFetch(registryHost, `${name}/manifests/${digest}`, { method: 'DELETE' })
    if (!delRes.ok && delRes.status !== 404) {
      console.warn(`[gc] Failed to delete ${name}:${tag} (${digest}): ${delRes.status}`)
    }
  }
}

export async function getAvailableTags(registryHost: string, deploymentId: string): Promise<string[]> {
  const res = await registryFetch(registryHost, `hangar-${deploymentId}/tags/list`)
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
  const res = await manifestExists(registryHost, `hangar-${deploymentId}`, tag)
  return res.ok
}