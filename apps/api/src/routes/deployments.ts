import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createDeployment, listDeployments, getDeployment } from '@hangar/db';
import { deployQueue } from '../lib/queue';
import { getVault } from '../lib/config';

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
    id: `dep-${nanoid(8).toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    sourceType: body.sourceType,
    sourceUrl: body.sourceUrl ?? null,
  });

  if (body.env && typeof body.env === 'object') {
    const vault = getVault()
    await vault.write(`hangar/data/deployments/${deployment.id}/env`, {
      data: body.env
    })
  }


  await deployQueue.add('deploy', { deploymentId: deployment.id })

  return c.json(deployment, 201);
});