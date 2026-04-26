import { execa } from 'execa'
import { join } from 'path'
import { writeLog } from '@hangar/db'
import { emitLog } from '../lib/emitter'
import Dockerode from 'dockerode'

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' })

export async function build(
  deploymentId: string,
  dir: string,
): Promise<string> {
  const imageTag = `hangar-${deploymentId}:latest`.toLowerCase()
  const planPath = join(dir, 'railpack-plan.json')

  // step 1 — prepare
  await writeLog(deploymentId, 'build', `📋 Analysing app...`)
  await emitLog(deploymentId, 'build', `📋 Analysing app...`)

  const prepareProc = execa('railpack', ['prepare', dir, '--plan-out', planPath])

  prepareProc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })

  prepareProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })

  await prepareProc

  // step 2 — build
  await writeLog(deploymentId, 'build', `🔨 Building image ${imageTag}`)
  await emitLog(deploymentId, 'build', `🔨 Building image ${imageTag}`)

  const buildProc = execa('buildctl', [
    '--addr', 'tcp://buildkit:1234',
    'build',
    '--local', `context=${dir}`,
    '--local', `dockerfile=${dir}`,
    '--frontend=gateway.v0',
    '--opt', `source=ghcr.io/railwayapp/railpack-frontend`,
    '--output', `type=docker,name=${imageTag}`,
  ])

  buildProc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })

  await new Promise<void>((resolve, reject) => {
    docker.loadImage(buildProc.stdout!, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })

  // tag for local registry
  const registryTag = `localhost:5000/${imageTag}`
  await docker.getImage(imageTag).tag({ repo: `localhost:5000/hangar-${deploymentId}`, tag: 'latest' })

  // push to local registry
  const pushStream = await docker.getImage(registryTag).push({})
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(pushStream, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })

  await buildProc

  await writeLog(deploymentId, 'build', `✅ Image built: ${imageTag}`)
  await emitLog(deploymentId, 'build', `✅ Image built: ${imageTag}`)

  return registryTag
}