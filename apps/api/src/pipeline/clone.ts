// apps/api/src/pipeline/clone.ts
import { execa } from 'execa';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeLog } from '@hangar/db';
import { getDeployment } from '@hangar/db';
import { emitLog } from '../lib/emitter';

export async function clone(deploymentId: string): Promise<string> {
	const deployment = getDeployment(deploymentId);
	if (!deployment) throw new Error('Deployment not found');

	const dir = await mkdtemp(join(tmpdir(), `hangar-${deploymentId}-`));

	writeLog(deploymentId, 'system', `📁 Cloning into ${dir}`);
	emitLog(deploymentId, 'system', `📁 Cloning into ${dir}`);

	const proc = execa('git', ['clone', '--depth=1', deployment.sourceUrl!, dir]);

	proc.stdout?.on('data', (chunk: Buffer) => {
		const line = chunk.toString().trim();
		if (!line) return;
		writeLog(deploymentId, 'build', line);
		emitLog(deploymentId, 'build', line);
	});

	proc.stderr?.on('data', (chunk: Buffer) => {
		const line = chunk.toString().trim();
		if (!line) return;
		writeLog(deploymentId, 'build', line);
		emitLog(deploymentId, 'build', line);
	});

	await proc;
	return dir;
}
