import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { auth, logs, deployments, databases } from './routes'
import { allowedOrigins, requireAuth } from './lib/auth'
import { cors } from 'hono/cors'
import './databases/queue'
import { serve } from '@hono/node-server'

const app = new OpenAPIHono()

app.use('*', cors({ origin: allowedOrigins(), allowHeaders: ['Authorization', 'Content-Type'], credentials: true }))
app.use('*', requireAuth)
app.get('/health', (c) => c.json({ ok: true }));
app.get('/docs', swaggerUI({ url: '/openapi.json' }))
app.route('/auth', auth)
app.route('/deployments', deployments)
app.route('/deployments', logs)
app.route('/databases', databases)

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Hangar API',
    version: '1.0.0',
    description: 'Self-hosted PaaS API — deployments, logs, and service management',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local dev' }],
})

if (process.env.SWAGGER_ENABLED === 'true') {
  app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  console.log('Swagger UI enabled at /docs')
}


serve({ fetch: app.fetch, port: 3001, hostname: '0.0.0.0' }, (info) => {
  console.log(`API running on http://0.0.0.0:${info.port}`)
})