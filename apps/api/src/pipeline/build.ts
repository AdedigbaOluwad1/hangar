// apps/api/src/pipeline/build.ts
import { execa } from 'execa';
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function build(
	deploymentId: string,
	dir: string,
): Promise<string> {
	const imageTag = `hangar-${deploymentId}:latest`.toLowerCase();

	writeLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);
	emitLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);

	writeFileSync(join(dir, '.railpackignore'), 'node_modules\n.git\n');

	const proc = execa('railpack', ['build', dir, '--name', imageTag]);

	proc.stdout?.on('data', (chunk: Buffer) => {
		for (const line of chunk.toString().split('\n').filter(Boolean)) {
			writeLog(deploymentId, 'build', line);
			emitLog(deploymentId, 'build', line);
		}
	});

	proc.stderr?.on('data', (chunk: Buffer) => {
		for (const line of chunk.toString().split('\n').filter(Boolean)) {
			writeLog(deploymentId, 'build', line);
			emitLog(deploymentId, 'build', line);
		}
	});

	await proc;
	return imageTag;
}
