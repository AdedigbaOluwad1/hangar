import { Hono } from 'hono'
import { tokenMatches, startSession, endSession } from '../lib'

export const auth = new Hono()

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!tokenMatches(token)) return c.json({ error: 'unauthorized' }, 401)
  await startSession(c)
  return c.json({ ok: true })
})

auth.post('/logout', (c) => {
  endSession(c)
  return c.json({ ok: true })
})

auth.get('/session', (c) => c.json({ ok: true }))
