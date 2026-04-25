import { execSync } from 'child_process';
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';

const CADDY_ADMIN = process.env.CADDY_ADMIN_URL ?? 'http://caddy:2019';

function getHostIp(): string {
  return execSync("getent hosts host-gateway | awk '{print $1}'")
    .toString()
    .trim();
}

export async function patchCaddy(
  deploymentId: string,
  port: number,
): Promise<string> {
  await writeLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);
  emitLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);

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
                upstreams: [{ dial: `${getHostIp()}:${port}` }],
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
