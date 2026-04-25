import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const pub = new Redis(REDIS_URL)
const sub = new Redis(REDIS_URL)

pub.on('error', (err) => console.error('Redis pub error:', err))
sub.on('error', (err) => console.error('Redis sub error:', err))

export async function emitLog(deploymentId: string, stream: string, line: string) {
  await pub.publish(`log:${deploymentId}`, JSON.stringify({ stream, line }))
}

export async function emitDone(deploymentId: string) {
  await pub.publish(`done:${deploymentId}`, '1')
}

export function subscribeToLogs(
  deploymentId: string,
  onLog: (log: { stream: string; line: string }) => void,
  onDone: () => void
) {
  const client = sub.duplicate()

  client.subscribe(`log:${deploymentId}`, `done:${deploymentId}`)

  client.on('message', (channel: string, message: string) => {
    if (channel === `log:${deploymentId}`) {
      onLog(JSON.parse(message))
    } else if (channel === `done:${deploymentId}`) {
      onDone()
      client.disconnect()
    }
  })

  return () => client.disconnect()
}