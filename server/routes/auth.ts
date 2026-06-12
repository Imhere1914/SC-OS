import type { Hono } from 'hono'
import {
  isAuthEnabled,
  verifyCredentials,
  createSession,
  destroySession,
  getSessionEmail,
  sessionCookie,
  clearSessionCookie,
  parseCookie,
  SESSION_COOKIE_NAME,
} from '../lib/auth'

/**
 * Auth routes — login / logout / me.
 * All three live under /api/auth/ which is always on the public allowlist
 * (the frontend needs /api/auth/me pre-login to decide what to render).
 */

// ── In-memory login rate limit: max 10 attempts per IP per 15 min ─────────────
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_MAX_ATTEMPTS
}

export function registerAuth(app: Hono) {
  app.post('/api/auth/login', async (c) => {
    if (!isAuthEnabled()) return c.json({ error: 'Auth is not enabled' }, 400)

    const ip = c.req.header('x-forwarded-for') ?? 'local'
    if (isRateLimited(ip)) {
      return c.json({ error: 'Too many attempts. Try again later.' }, 429)
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!verifyCredentials(email, password)) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = createSession(email)
    c.header('Set-Cookie', sessionCookie(token))
    return c.json({ ok: true })
  })

  app.post('/api/auth/logout', (c) => {
    const token = parseCookie(c.req.header('cookie') ?? '', SESSION_COOKIE_NAME)
    if (token) destroySession(token)
    c.header('Set-Cookie', clearSessionCookie())
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', (c) => {
    const enabled = isAuthEnabled()
    if (!enabled) return c.json({ authenticated: true, auth_enabled: false })
    const token = parseCookie(c.req.header('cookie') ?? '', SESSION_COOKIE_NAME)
    const email = token ? getSessionEmail(token) : null
    if (email) return c.json({ authenticated: true, auth_enabled: true, email })
    return c.json({ authenticated: false, auth_enabled: true })
  })
}
