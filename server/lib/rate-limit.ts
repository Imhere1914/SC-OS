import type { Context } from 'hono'

// ── In-memory sliding-window rate limiter ────────────────────────────────────
// Keyed by `${bucket}:${ip}`. Each key holds a list of request timestamps within
// the window; a request is allowed while the count stays under `max`. This is a
// per-process limiter (no shared store) — adequate as an abuse backstop in front
// of the public write endpoints. nginx already fronts the app, so x-forwarded-for
// carries the real client IP.

type Entry = { hits: number[] }

const store = new Map<string, Entry>()

/** Largest window we expect to track; used to decide when an entry is safe to drop. */
let maxWindowSeen = 60_000

/** Resolve the client IP from x-forwarded-for (first value) with a safe fallback. */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return c.req.header('x-real-ip')?.trim() || 'unknown'
}

/**
 * Sliding-window check. Returns whether the call is allowed and, when not, the
 * number of seconds until the oldest in-window hit expires (for Retry-After).
 */
export function rateLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfter?: number } {
  if (windowMs > maxWindowSeen) maxWindowSeen = windowMs
  const now = Date.now()
  const cutoff = now - windowMs
  const mapKey = `${bucket}:${key}`
  let entry = store.get(mapKey)
  if (!entry) {
    entry = { hits: [] }
    store.set(mapKey, entry)
  }
  // Drop timestamps outside the window.
  if (entry.hits.length && entry.hits[0] <= cutoff) {
    entry.hits = entry.hits.filter((t) => t > cutoff)
  }
  if (entry.hits.length >= max) {
    const oldest = entry.hits[0]
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { ok: false, retryAfter }
  }
  entry.hits.push(now)
  return { ok: true }
}

/**
 * Hono helper. Applies the limit for the current request's IP; returns a 429
 * Response (with Retry-After) when over the limit, or null to continue.
 */
export function enforceRateLimit(
  c: Context,
  bucket: string,
  max: number,
  windowMs: number,
): Response | null {
  const res = rateLimit(bucket, clientIp(c), max, windowMs)
  if (res.ok) return null
  return c.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    429,
    { 'Retry-After': String(res.retryAfter ?? 60) },
  )
}

// ── Periodic cleanup ─────────────────────────────────────────────────────────
// Every minute, evict entries whose newest hit is older than the largest window
// we've tracked, so the map can't grow unbounded from one-off IPs.
const cleanup = setInterval(() => {
  const cutoff = Date.now() - maxWindowSeen
  for (const [key, entry] of store) {
    if (!entry.hits.length || entry.hits[entry.hits.length - 1] <= cutoff) {
      store.delete(key)
    }
  }
}, 60_000)
// Don't keep the event loop alive for cleanup alone.
if (typeof cleanup.unref === 'function') cleanup.unref()
