import { execa } from 'execa'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeLog, getDeployment } from '@hangar/db'
import { emitLog } from '../lib'

export async function clone(deploymentId: string, buildId: string): Promise<string> {
  const deployment = await getDeployment(deploymentId)
  if (!deployment) throw new Error('Deployment not found')
  if (!deployment.sourceUrl) throw new Error('No source URL provided')

  const dir = await mkdtemp(join(tmpdir(), `hangar-${deploymentId}-`))

  await writeLog(buildId, 'system', `📁 Cloning into ${dir}`)
  await emitLog(buildId, 'system', `📁 Cloning into ${dir}`)

  const proc = execa('git', ['clone', '--depth=1', deployment.sourceUrl, dir])

  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      writeLog(buildId, 'build', line)
      emitLog(buildId, 'build', line)
    }
  })

  await proc
  return dir
}