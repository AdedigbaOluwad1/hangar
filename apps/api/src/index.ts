import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { deployments } from './routes/deployments';
import { logs } from './routes/logs';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));
app.route('/deployments', deployments);
app.route('/deployments', logs);

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('⚓ Hangar API running on http://localhost:3001');
});
