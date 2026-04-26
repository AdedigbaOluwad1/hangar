import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';
import { getConfig } from '../lib/config';

async function getCaddyAdmin(): Promise<string> {
  const config = await getConfig()
  return config.caddy_admin_url ?? 'http://caddy:2019'
}

async function getConsulAddr(): Promise<string> {
  const config = await getConfig()
  return config.consul_addr ?? 'http://127.0.0.1:8500'
}

async function getServiceAddress(deploymentId: string): Promise<string> {
  const CONSUL_ADDR = await getConsulAddr()

  const res = await fetch(
    `${CONSUL_ADDR}/v1/health/service/hangar-${deploymentId}?passing=true`,
    {
      // @ts-ignore
      agent: new (require('https').Agent)({ rejectUnauthorized: false })
    }
  );
  const services = await res.json();
  if (!services.length) throw new Error(`Service hangar-${deploymentId} not found in Consul`);
  const { Address, Port } = services[0].Service;
  return `${Address}:${Port}`;
}

async function waitForService(deploymentId: string, retries = 20, delay = 3000): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const address = await getServiceAddress(deploymentId);
      if (address) return address;
    } catch { }
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error(`Service hangar-${deploymentId} never became healthy`);
}

export async function patchCaddy(
  deploymentId: string,
): Promise<string> {
  const CADDY_ADMIN = await getCaddyAdmin()

  await writeLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);
  emitLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);

  const address = await waitForService(deploymentId);

  const route = {
    match: [{ path: [`/deploys/${deploymentId}`, `/deploys/${deploymentId}/*`] }],
    handle: [
      {
        handler: 'subroute',
        routes: [
          {
            handle: [
              {
                handler: 'rewrite',
                strip_path_prefix: `/deploys/${deploymentId}`,
              },
              {
                handler: 'reverse_proxy',
                upstreams: [{ dial: address }],
              },
            ],
          },
        ],
      },
    ],
  };

  const existing = await fetch(
    `${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`,
  );
  const routes = await existing.json();

  const res = await fetch(
    `${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([route, ...routes]),
    },
  );

  if (!res.ok) {
    throw new Error(`Caddy admin API error: ${res.status} ${await res.text()}`);
  }

  const liveUrl = `http://localhost/deploys/${deploymentId}`;
  await writeLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`);
  emitLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`);
  return liveUrl;
}