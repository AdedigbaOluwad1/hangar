// apps/api/src/routes/deployments.ts
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createDeployment, listDeployments, getDeployment } from '@hangar/db';
import { runPipeline } from '../pipeline';

export const deployments = new Hono();

// list
deployments.get('/', async (c) => {
	return c.json(await listDeployments());
});

// get one
deployments.get('/:id', async (c) => {
	const deployment = await getDeployment(c.req.param('id'));
	if (!deployment) return c.json({ error: 'Not found' }, 404);
	return c.json(deployment);
});

// create
deployments.post('/', async (c) => {
	const body = await c.req.json();

	if (!body.sourceType || !['git', 'zip'].includes(body.sourceType)) {
		return c.json({ error: 'Invalid sourceType' }, 400);
	}
	if (body.sourceType === 'git' && !body.sourceUrl) {
		return c.json({ error: 'sourceUrl required for git deploys' }, 400);
	}

	const deployment = await createDeployment({
		id: `dep_${nanoid(8)}`,
		sourceType: body.sourceType,
		sourceUrl: body.sourceUrl ?? null,
	});

	// kick off pipeline async — don't await
	runPipeline(deployment.id).catch(console.error);

	return c.json(deployment, 201);
});
