import { randomBytes, timingSafeEqual, createHash } from 'crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Auth — env-credential login + file-backed sessions.
 *
 * Credentials come from AUTH_EMAIL / AUTH_PASSWORD. If either is unset, auth
 * is DISABLED entirely (everything stays open — preserves local-dev behavior).
 *
 * Sessions are stored in sessions.json in the data dir as SHA-256 hashes of
 * the raw token (the raw token only ever lives in the client cookie).
 */

const DATA_DIR = process.env.AIOS_DATA_DIR ?? path.join(process.env.HOME ?? os.homedir() ?? '/tmp', '.ai-os')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const SESSION_COOKIE_NAME = 'aios_session'
export const SESSION_MAX_AGE_SECONDS = 2592000 // 30 days

type SessionRecord = {
  token_hash: string
  created_at: string
  expires_at: string
  user_email: string
}

// ── Credentials ───────────────────────────────────────────────────────────────

export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_EMAIL?.trim() && process.env.AUTH_PASSWORD)
}

export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.AUTH_EMAIL?.trim()
  const expectedPassword = process.env.AUTH_PASSWORD
  if (!expectedEmail || !expectedPassword) return false

  const emailOk = email.trim().toLowerCase() === expectedEmail.toLowerCase()

  // Constant-time password compare — pad both buffers to equal length so
  // timingSafeEqual never throws and length isn't leaked via early exit.
  const a = Buffer.from(password)
  const b = Buffer.from(expectedPassword)
  const len = Math.max(a.length, b.length, 1)
  const aPad = Buffer.alloc(len)
  const bPad = Buffer.alloc(len)
  a.copy(aPad)
  b.copy(bPad)
  const passwordOk = timingSafeEqual(aPad, bPad) && a.length === b.length

  return emailOk && passwordOk
}

// ── Session persistence (file-backed, atomic writes) ─────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function readSessions(): SessionRecord[] {
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : []
  } catch {
    return []
  }
}

function writeSessions(sessions: SessionRecord[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${SESSIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf8')
  fs.renameSync(tmp, SESSIONS_FILE)
}

function pruneExpired(sessions: SessionRecord[]): SessionRecord[] {
  const now = Date.now()
  return sessions.filter(s => Date.parse(s.expires_at) > now)
}

export function createSession(email: string): string {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const record: SessionRecord = {
    token_hash: hashToken(token),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    user_email: email.trim().toLowerCase(),
  }
  writeSessions([...pruneExpired(readSessions()), record])
  return token
}

export function validateSession(token: string): boolean {
  return getSessionEmail(token) !== null
}

/** Returns the session's user email if the token is valid + unexpired, else null. */
export function getSessionEmail(token: string): string | null {
  if (!token) return null
  const hash = hashToken(token)
  const sessions = readSessions()
  const live = pruneExpired(sessions)
  // Occasionally persist the pruned list so the file doesn't grow unboundedly.
  if (live.length !== sessions.length && Math.random() < 0.1) writeSessions(live)
  const match = live.find(s => s.token_hash === hash)
  return match ? match.user_email : null
}

export function destroySession(token: string): void {
  if (!token) return
  const hash = hashToken(token)
  writeSessions(pruneExpired(readSessions()).filter(s => s.token_hash !== hash))
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/**
 * Secure is opt-out via COOKIE_INSECURE=1 (local dev over plain http);
 * production serves both brands over HTTPS so cookies are Secure by default.
 */
const SECURE_ATTR = process.env.COOKIE_INSECURE === '1' ? '' : '; Secure'

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${SECURE_ATTR}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${SECURE_ATTR}`
}

export function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}
