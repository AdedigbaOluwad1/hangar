// apps/api/src/pipeline/clone.ts
import { execa } from 'execa'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeLog, getDeployment } from '@hangar/db'
import { emitLog } from '../lib/emitter'

export async function clone(deploymentId: string): Promise<string> {
  const deployment = await getDeployment(deploymentId)
  if (!deployment) throw new Error('Deployment not found')
  if (!deployment.sourceUrl) throw new Error('No source URL provided')

  const dir = await mkdtemp(join(tmpdir(), `hangar-${deploymentId}-`))

  await writeLog(deploymentId, 'system', `📁 Cloning into ${dir}`)
  await emitLog(deploymentId, 'system', `📁 Cloning into ${dir}`)

  const proc = execa('git', ['clone', '--depth=1', deployment.sourceUrl, dir])

  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(deploymentId, 'build', line)
      emitLog(deploymentId, 'build', line)
    }
  })

  await proc
  return dir
}