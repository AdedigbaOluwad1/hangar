// apps/api/src/pipeline/caddy.ts
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';

const CADDY_ADMIN = process.env.CADDY_ADMIN_URL ?? 'http://caddy:2019';

export async function patchCaddy(
	deploymentId: string,
	port: number,
): Promise<string> {
	writeLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);
	emitLog(deploymentId, 'deploy', `🌐 Configuring Caddy route`);

	const route = {
		match: [{ path: [`/deploys/${deploymentId}/*`] }],
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
								upstreams: [{ dial: `host.docker.internal:${port}` }],
							},
						],
					},
				],
			},
		],
	};

	const res = await fetch(
		`${CADDY_ADMIN}/config/apps/http/servers/srv0/routes/0`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(route),
		},
	);

	if (!res.ok) {
		throw new Error(`Caddy admin API error: ${res.status} ${await res.text()}`);
	}

	const liveUrl = `http://localhost/deploys/${deploymentId}`;
	writeLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`);
	emitLog(deploymentId, 'deploy', `🔗 Live at ${liveUrl}`);

	return liveUrl;
}
