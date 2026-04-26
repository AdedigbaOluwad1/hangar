import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { deployments } from './routes/deployments'
import { logs } from './routes/logs'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'

const app = new OpenAPIHono()

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }))
app.route('/deployments', deployments)
app.route('/deployments', logs)

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Hangar API',
    version: '1.0.0',
    description: 'Self-hosted PaaS API — deployments, logs, and service management',
  },
  servers: [{ url: 'http://localhost/api', description: 'Local dev' }],
})

if (process.env.SWAGGER_ENABLED === 'true') {
  app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  console.log('Swagger UI enabled at /docs')
}


serve({ fetch: app.fetch, port: 3001, hostname: '0.0.0.0' }, (info) => {
  console.log(`API running on http://0.0.0.0:${info.port}`)
})