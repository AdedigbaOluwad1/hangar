import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'

const COOKIE_NAME = 'hangar_session'
const SESSION_SECONDS = 12 * 60 * 60
const PUBLIC_PATHS = new Set(['/health', '/auth/login', '/auth/logout'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim())
}

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function sessionSecret(adminToken: string): string {
  return createHmac('sha256', adminToken).update('hangar-session').digest('hex')
}

function isSecureRequest(c: Context): boolean {
  return c.req.header('X-Forwarded-Proto') === 'https' || new URL(c.req.url).protocol === 'https:'
}

function isTrustedOrigin(c: Context): boolean {
  const origin = c.req.header('Origin')
  if (!origin) return true
  if (allowedOrigins().includes(origin)) return true
  try {
    return new URL(origin).host === c.req.header('Host')
  } catch {
    return false
  }
}

export function tokenMatches(token: string): boolean {
  const expected = process.env.ADMIN_TOKEN
  return Boolean(expected) && Boolean(token) && safeEqual(token, expected as string)
}

export async function startSession(c: Context): Promise<void> {
  const adminToken = process.env.ADMIN_TOKEN as string
  const expiresAt = Date.now() + SESSION_SECONDS * 1000
  await setSignedCookie(c, COOKIE_NAME, String(expiresAt), sessionSecret(adminToken), {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

export function endSession(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

async function hasValidSession(c: Context, adminToken: string): Promise<boolean> {
  const value = await getSignedCookie(c, sessionSecret(adminToken), COOKIE_NAME)
  return typeof value === 'string' && Number(value) > Date.now()
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS' || PUBLIC_PATHS.has(c.req.path)) return next()

  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) return deny(c)

  const header = c.req.header('Authorization') ?? ''
  if (header.startsWith('Bearer ')) {
    return tokenMatches(header.slice(7)) ? next() : deny(c)
  }

  if (!(await hasValidSession(c, adminToken))) return deny(c)
  if (!SAFE_METHODS.has(c.req.method) && !isTrustedOrigin(c)) {
    return c.json({ error: 'forbidden' }, 403)
  }
  return next()
}

function deny(c: Context) {
  c.header('WWW-Authenticate', 'Bearer')
  return c.json({ error: 'unauthorized' }, 401)
}
