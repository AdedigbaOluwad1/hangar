import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const pub = new Redis(REDIS_URL)
const sub = new Redis(REDIS_URL)

pub.on('error', (err) => console.error('Redis pub error:', err))
sub.on('error', (err) => console.error('Redis sub error:', err))

export async function emitLog(buildId: string, stream: string, line: string) {
  await pub.publish(`log:${buildId}`, JSON.stringify({ stream, line }))
}

export async function emitDone(buildId: string) {
  await pub.publish(`done:${buildId}`, '1')
}

export function subscribeToLogs(
  buildId: string,
  onLog: (log: { stream: string; line: string }) => void,
  onDone: () => void
) {
  const client = sub.duplicate()

  client.subscribe(`log:${buildId}`, `done:${buildId}`)

  client.on('message', (channel: string, message: string) => {
    if (channel === `log:${buildId}`) {
      onLog(JSON.parse(message))
    } else if (channel === `done:${buildId}`) {
      onDone()
      client.disconnect()
    }
  })

  return () => client.disconnect()
}