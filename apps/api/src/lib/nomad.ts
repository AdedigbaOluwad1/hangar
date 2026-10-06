import { getConfig } from "./config"
import { buildJobSpec, jobId } from "./job-spec"

async function getNomadAddr(): Promise<string> {
  const config = await getConfig()
  return config.nomad_addr ?? 'http://127.0.0.1:4646'
}

async function nomadHeaders(): Promise<Record<string, string>> {
  const config = await getConfig()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.nomad_token) headers['X-Nomad-Token'] = config.nomad_token
  return headers
}

export async function submitJob(
  deploymentId: string,
  imageTag: string,
  resources: { cpu?: number; memoryMb?: number } = {},
) {
  const NOMAD_ADDR = await getNomadAddr()
  const job = buildJobSpec(deploymentId, imageTag, resources)

  const res = await fetch(`${NOMAD_ADDR}/v1/jobs`, {
    method: 'POST',
    headers: await nomadHeaders(),
    body: JSON.stringify(job),
  })

  if (!res.ok) {
    throw new Error(`Nomad job submit failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

export async function getJobResources(deploymentId: string): Promise<{ cpu?: number; memoryMb?: number }> {
  const NOMAD_ADDR = await getNomadAddr()
  const res = await fetch(`${NOMAD_ADDR}/v1/job/${jobId(deploymentId)}`, { headers: await nomadHeaders() })
  if (!res.ok) return {}
  const job = await res.json()
  const resources = job?.TaskGroups?.[0]?.Tasks?.[0]?.Resources
  return { cpu: resources?.CPU, memoryMb: resources?.MemoryMB }
}

export async function stopJob(deploymentId: string) {
  const NOMAD_ADDR = await getNomadAddr()
  const res = await fetch(
    `${NOMAD_ADDR}/v1/job/${jobId(deploymentId)}`,
    { method: 'DELETE', headers: await nomadHeaders() }
  )
  if (!res.ok) {
    throw new Error(`Nomad job stop failed: ${res.status}`)
  }
}

export async function getJobStatus(deploymentId: string) {
  const NOMAD_ADDR = await getNomadAddr()
  const res = await fetch(
    `${NOMAD_ADDR}/v1/job/${jobId(deploymentId)}/allocations`,
    { headers: await nomadHeaders() }
  )
  if (!res.ok) return null
  const allocs = await res.json()
  const latest = allocs[0]
  return {
    status: latest?.ClientStatus ?? 'unknown',
    allocId: latest?.ID,
  }
}