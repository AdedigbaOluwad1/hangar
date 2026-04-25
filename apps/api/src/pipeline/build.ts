import { execa } from 'execa';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';
import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export async function build(
	deploymentId: string,
	dir: string,
): Promise<string> {
	const imageTag = `hangar-${deploymentId.toLowerCase().replace(/[^a-z0-9]/g, '')}:latest`;

	await writeLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);
	emitLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);

	// get railpack plan
	const { stdout } = await execa('railpack', ['plan', dir]);
	const plan = JSON.parse(stdout);

	const startCommand = plan.deploy?.startCommand ?? 'node index.js';
	const nodeVersion = '20';
	const vars = plan.deploy?.variables ?? {};

	const envLines = Object.entries(vars)
		.map(([k, v]) => `ENV ${k}="${v}"`)
		.join('\n');

	// generate dockerfile
	const dockerfile = `
    FROM node:${nodeVersion}-alpine
    WORKDIR /app
    COPY package*.json yarn.lock* ./
    RUN yarn install --frozen-lockfile --production=false
    COPY . .
    ${envLines}
    EXPOSE 3000
    CMD ${JSON.stringify(startCommand.split(' '))}
  `.trim();

	await writeLog(deploymentId, 'build', `📋 Generated Dockerfile`);
	emitLog(deploymentId, 'build', `📋 Generated Dockerfile`);

	// write dockerfile into the cloned dir
	await writeFile(join(dir, 'Dockerfile'), dockerfile);

	// create tar of the build context
	const contextTarPath = `${dir}.tar`;

	// write .dockerignore
	await writeFile(
		join(dir, '.dockerignore'),
		`node_modules
      .git
      .yarn
      *.log
    `.trim(),
	);

	await execa('tar', ['-cf', contextTarPath, '-C', dir, '.']);

	await writeLog(deploymentId, 'build', `🐳 Building Docker image...`);
	emitLog(deploymentId, 'build', `🐳 Building Docker image...`);

	// build with dockerode — no BuildKit tarball issues
	const buildStream = await docker.buildImage(contextTarPath, { t: imageTag });

	await new Promise<void>((resolve, reject) => {
		docker.modem.followProgress(
			buildStream,
			(err: Error | null) => (err ? reject(err) : resolve()),
			(event: any) => {
				const line = event.stream ?? event.status ?? '';
				if (line.trim()) {
					writeLog(deploymentId, 'build', line.trim());
					emitLog(deploymentId, 'build', line.trim());
				}
			},
		);
	});

	await writeLog(deploymentId, 'build', `✅ Image built: ${imageTag}`);
	emitLog(deploymentId, 'build', `✅ Image built: ${imageTag}`);

	return imageTag;
}
