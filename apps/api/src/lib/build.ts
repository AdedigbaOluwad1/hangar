export async function gcOldImage(registryHost: string, deploymentId: string): Promise<void> {
  const name = `hangar-${deploymentId}`
  const base = `http://${registryHost}/v2/${name}`

  const headRes = await fetch(`${base}/manifests/latest`, {
    headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' },
  })

  if (!headRes.ok) {
    // 404 = no previous image, nothing to GC
    if (headRes.status !== 404) {
      console.warn(`[gc] Failed to fetch manifest for ${name}: ${headRes.status}`)
    }
    return
  }

  const digest = headRes.headers.get('Docker-Content-Digest')
  if (!digest) {
    console.warn(`[gc] No Docker-Content-Digest header for ${name}, skipping GC`)
    return
  }

  const delRes = await fetch(`${base}/manifests/${digest}`, { method: 'DELETE' })
  if (!delRes.ok && delRes.status !== 404) {
    console.warn(`[gc] Failed to delete manifest ${digest} for ${name}: ${delRes.status}`)
  }
}