import { execa } from 'execa';
import { writeLog } from '@hangar/db';
import { emitLog } from '../lib/emitter';
import { join } from 'path';

export async function build(
  deploymentId: string,
  dir: string,
): Promise<string> {
  const imageTag = `hangar-${deploymentId}:latest`.toLowerCase();
  await writeLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);
  emitLog(deploymentId, 'build', `🔨 Building image ${imageTag}`);

  const planPath = join(dir, 'railpack-plan.json')

  // step 1 — prepare: detect runtime, generate build plan
  await writeLog(deploymentId, 'build', `📋 Analysing app...`);
  emitLog(deploymentId, 'build', `📋 Analysing app...`);

  const prepareProc = execa('railpack', [
    'prepare', dir,
    '--plan-out', planPath,
  ])

  prepareProc.stdout?.on('data', async (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      await writeLog(deploymentId, 'build', line);
      emitLog(deploymentId, 'build', line);
    }
  })
  prepareProc.stderr?.on('data', async (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      await writeLog(deploymentId, 'build', line);
      emitLog(deploymentId, 'build', line);
    }
  })

  await prepareProc

  // step 2 — build with buildctl directly (no docker CLI needed)
  await writeLog(deploymentId, 'build', `🐳 Building image...`);
  emitLog(deploymentId, 'build', `🐳 Building image...`);

  const buildProc = execa('buildctl', [
    '--addr', 'tcp://buildkit:1234',
    'build',
    '--local', `context=${dir}`,
    '--local', `dockerfile=${dir}`,
    '--frontend=gateway.v0',
    '--opt', 'source=ghcr.io/railwayapp/railpack-frontend',
    '--output', `type=docker,name=${imageTag}`,
  ])

  // pipe stdout (the image tarball) to docker load via dockerode
  // collect stderr for logs
  buildProc.stderr?.on('data', async (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      await writeLog(deploymentId, 'build', line);
      emitLog(deploymentId, 'build', line);
    }
  })

  // load image from buildctl stdout
  const Dockerode = (await import('dockerode')).default
  const docker = new Dockerode({ socketPath: '/var/run/docker.sock' })

  await new Promise<void>((resolve, reject) => {
    docker.loadImage(buildProc.stdout!, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })

  await buildProc

  await writeLog(deploymentId, 'build', `✅ Image built: ${imageTag}`);
  emitLog(deploymentId, 'build', `✅ Image built: ${imageTag}`);

  return imageTag;
}