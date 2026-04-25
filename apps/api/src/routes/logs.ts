// apps/api/src/routes/logs.ts
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getLogs, getDeployment } from '@hangar/db';
import { logEmitter } from '../lib/emitter';

export const logs = new Hono();

logs.get('/:id/logs', (c) => {
	const { id } = c.req.param();

	return streamSSE(c, async (stream) => {
		// 1. replay history
		const history =  await getLogs(id);
		for (const log of history) {
			await stream.writeSSE({
				event: 'log',
				data: JSON.stringify({ stream: log.stream, line: log.line }),
			});
		}

		// 2. if still active, stream live
		const deployment = await getDeployment(id);
		const active = ['pending', 'building', 'deploying'];

		if (!deployment || !active.includes(deployment.status)) {
			await stream.writeSSE({ event: 'done', data: '' });
			return;
		}

		await new Promise<void>((resolve) => {
			const onLog = async (log: { stream: string; line: string }) => {
				await stream.writeSSE({
					event: 'log',
					data: JSON.stringify(log),
				});
			};

			const onDone = async () => {
				logEmitter.off(`log:${id}`, onLog);
				await stream.writeSSE({ event: 'done', data: '' });
				resolve();
			};

			logEmitter.on(`log:${id}`, onLog);
			logEmitter.once(`done:${id}`, onDone);
		});
	});
});
