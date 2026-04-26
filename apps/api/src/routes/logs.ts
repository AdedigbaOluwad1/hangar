import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getLogs, getDeployment } from '@hangar/db';
import { subscribeToLogs } from '../lib/emitter';

export const logs = new Hono();

logs.get('/:id/logs', (c) => {
  const { id } = c.req.param();

  return streamSSE(c, async (stream) => {
    const history = await getLogs(id);
    for (const log of history) {
      await stream.writeSSE({
        event: 'log',
        data: JSON.stringify({ stream: log.stream, line: log.line }),
      });
    }

    const deployment = await getDeployment(id);
    const active = ['pending', 'building', 'deploying'];

    if (!deployment || !active.includes(deployment.status)) {
      await stream.writeSSE({ event: 'done', data: '' });
      return;
    }

    await new Promise<void>((resolve) => {
      const unsub = subscribeToLogs(
        id,
        async (log) => {
          await stream.writeSSE({
            event: 'log',
            data: JSON.stringify(log),
          });
        },
        async () => {
          unsub()
          await stream.writeSSE({ event: 'done', data: '' });
          resolve();
        },
      );
    });
  });
});