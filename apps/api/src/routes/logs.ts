import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { getLogs, getDeployment, getLatestBuild, getBuild } from '@hangar/db'
import { subscribeToLogs } from '../lib/emitter'

export const logs = new Hono()

// ── GET /:id/logs — stream latest build logs ──────────────
// Accepts optional ?buildId= to stream a specific build

logs.get('/:id/logs', (c) => {
  const { id } = c.req.param()
  const buildId = c.req.query('buildId')

  return streamSSE(c, async (stream) => {
    const deployment = await getDeployment(id)
    if (!deployment) {
      await stream.writeSSE({ event: 'done', data: '' })
      return
    }

    const build = buildId
      ? await getBuild(buildId)
      : await getLatestBuild(id)

    if (!build) {
      await stream.writeSSE({ event: 'done', data: '' })
      return
    }

    const history = await getLogs(build.id)
    for (const log of history) {
      await stream.writeSSE({
        event: 'log',
        data: JSON.stringify({ stream: log.stream, line: log.line }),
      })
    }

    const active = ['building', 'deploying']
    if (!active.includes(build.status)) {
      await stream.writeSSE({ event: 'done', data: '' })
      return
    }

    await new Promise<void>((resolve) => {
      const unsub = subscribeToLogs(
        build.id,
        async (log) => {
          await stream.writeSSE({
            event: 'log',
            data: JSON.stringify(log),
          })
        },
        async () => {
          unsub()
          await stream.writeSSE({ event: 'done', data: '' })
          resolve()
        },
      )
    })
  })
})

// ── GET /:id/builds/:buildId/logs — stream specific build logs

logs.get('/:id/builds/:buildId/logs', (c) => {
  const buildId = c.req.param('buildId')

  return streamSSE(c, async (stream) => {
    const build = await getBuild(buildId)
    if (!build) {
      await stream.writeSSE({ event: 'done', data: '' })
      return
    }

    const history = await getLogs(buildId)
    for (const log of history) {
      await stream.writeSSE({
        event: 'log',
        data: JSON.stringify({ stream: log.stream, line: log.line }),
      })
    }

    const active = ['building', 'deploying']
    if (!active.includes(build.status)) {
      await stream.writeSSE({ event: 'done', data: '' })
      return
    }

    await new Promise<void>((resolve) => {
      const unsub = subscribeToLogs(
        buildId,
        async (log) => {
          await stream.writeSSE({
            event: 'log',
            data: JSON.stringify(log),
          })
        },
        async () => {
          unsub()
          await stream.writeSSE({ event: 'done', data: '' })
          resolve()
        },
      )
    })
  })
})