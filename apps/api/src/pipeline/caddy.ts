import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'
import { getConfig } from '../lib/config'

async function getCaddyAdmin(): Promise<string> {
  return process.env.CADDY_ADMIN_URL ?? 'http://127.0.0.1:2019'
}

async function getServiceAddress(deploymentId: string): Promise<string> {
  const CONSUL_ADDR = process.env.CONSUL_ADDR ?? 'http://10.88.0.1:8500'
  const res = await fetch(
    `${CONSUL_ADDR}/v1/health/service/hangar-${deploymentId}?passing=true`
  )
  const services = await res.json()
  if (!services.length) throw new Error(`Service hangar-${deploymentId} not found in Consul`)
  const { Address, Port } = services[0].Service
  return `${Address}:${Port}`
}

async function waitForService(deploymentId: string, retries = 20, delay = 3000): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const address = await getServiceAddress(deploymentId)
      if (address) return address
    } catch { }
    await new Promise(r => setTimeout(r, delay))
  }
  throw new Error(`Service hangar-${deploymentId} never became healthy`)
}

export async function patchCaddy(deploymentId: string): Promise<string> {
  const CADDY_ADMIN = await getCaddyAdmin()

  await writeLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`)
  emitLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`)

  const address = await waitForService(deploymentId)

  const route = {
    match: [{ host: [`${deploymentId}.localhost`] }],
    handle: [
      {
        handler: 'reverse_proxy',
        upstreams: [{ dial: address }],
      },
    ],
  }

  const existing = await fetch(
    `${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`
  )
  const routes = await existing.json()

  const res = await fetch(
    `${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([route, ...routes]),
    }
  )

  if (!res.ok) {
    throw new Error(`Caddy admin API error: ${res.status} ${await res.text()}`)
  }

  const liveUrl = `http://${deploymentId}.localhost`
  await writeLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`)
  emitLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`)
  return liveUrl
}

export async function unpatchCaddy(deploymentId: string): Promise<void> {
  const CADDY_ADMIN = await getCaddyAdmin()

  const existing = await fetch(
    `${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`
  )
  const routes: any[] = await existing.json()

  const filtered = routes.filter((route) => {
    const hosts: string[] = route?.match?.[0]?.host ?? []
    return !hosts.some((h) => h === `${deploymentId}.localhost`)
  })

  await fetch(`${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filtered),
  })
}