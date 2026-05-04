import { getConfig } from "./config"

async function getNomadAddr(): Promise<string> {
  const config = await getConfig()
  return config.nomad_addr ?? 'http://127.0.0.1:4646'
}

export async function submitJob(
  deploymentId: string,
  imageTag: string,
  userEnv: Record<string, string> = {},
  resources: { cpu?: number; memoryMb?: number } = {},
) {
  const NOMAD_ADDR = await getNomadAddr()
  const job = {
    Job: {
      ID: `hangar-${deploymentId}`,
      Name: `hangar-${deploymentId}`,
      Type: 'service',
      Datacenters: ['dc1'],
      TaskGroups: [
        {
          Name: 'app',
          Count: 1,
          Networks: [
            {
              DynamicPorts: [
                { Label: 'http', To: 3000 }
              ]
            }
          ],
          Tasks: [
            {
              Name: 'web',
              Driver: 'podman',
              Config: {
                image: imageTag,
                ports: ['http'],
              },
              Env: {
                PORT: '3000',
                ...userEnv,
              },
              Resources: {
                CPU: resources.cpu ?? 500,
                MemoryMB: resources.memoryMb ?? 512,
              },
              Services: [
                {
                  Name: `hangar-${deploymentId}`,
                  PortLabel: 'http',
                  Checks: [
                    {
                      Type: 'http',
                      Path: '/',
                      Interval: 10_000_000_000,
                      Timeout: 2_000_000_000,
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }

  const res = await fetch(`${NOMAD_ADDR}/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  })

  if (!res.ok) {
    throw new Error(`Nomad job submit failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

export async function stopJob(deploymentId: string) {
  const NOMAD_ADDR = await getNomadAddr()
  const res = await fetch(
    `${NOMAD_ADDR}/v1/job/hangar-${deploymentId}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    throw new Error(`Nomad job stop failed: ${res.status}`)
  }
}

export async function getJobStatus(deploymentId: string) {
  const NOMAD_ADDR = await getNomadAddr()
  const res = await fetch(
    `${NOMAD_ADDR}/v1/job/hangar-${deploymentId}/allocations`
  )
  if (!res.ok) return null
  const allocs = await res.json()
  const latest = allocs[0]
  return {
    status: latest?.ClientStatus ?? 'unknown',
    allocId: latest?.ID,
  }
}