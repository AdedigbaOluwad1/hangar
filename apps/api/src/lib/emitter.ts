import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const pub = new Redis(REDIS_URL)
const sub = new Redis(REDIS_URL)

export function emitLog(deploymentId: string, stream: string, line: string) {
  pub.publish(`log:${deploymentId}`, JSON.stringify({ stream, line }))
}

export function emitDone(deploymentId: string) {
  pub.publish(`done:${deploymentId}`, '1')
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