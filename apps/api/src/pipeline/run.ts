// apps/api/src/pipeline/run.ts
import Dockerode from 'dockerode';
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';
import { getFreePort } from '../lib/port';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export async function runContainer(
	deploymentId: string,
	imageTag: string,
): Promise<{ containerId: string; port: number }> {
	const port = await getFreePort();

	await writeLog(
		deploymentId,
		'deploy',
		`🐳 Starting container on port ${port}`,
	);
	emitLog(deploymentId, 'deploy', `🐳 Starting container on port ${port}`);

	const container = await docker.createContainer({
		Image: imageTag,
    Env: ['PORT=3000'],
		ExposedPorts: { '3000/tcp': {} },
		HostConfig: {
			PortBindings: { '3000/tcp': [{ HostPort: String(port) }] },
			RestartPolicy: { Name: 'unless-stopped' },
		},
		Labels: { 'hangar.deployment': deploymentId },
	});

	await container.start();

	const short = container.id.slice(0, 12);
	await writeLog(deploymentId, 'deploy', `✅ Container ${short} running`);
	emitLog(deploymentId, 'deploy', `✅ Container ${short} running`);

	return { containerId: container.id, port };
}
