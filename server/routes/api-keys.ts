/**
 * API key management routes.
 *
 * GET    /api/api-keys           — list keys (no key_hash)
 * POST   /api/api-keys           — create a key (returns raw key once)
 * DELETE /api/api-keys/:id/revoke — revoke (soft-disable)
 * DELETE /api/api-keys/:id        — delete permanently
 */
import type { Hono } from 'hono'
import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey } from '../stores/api-keys-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerApiKeys(app: Hono): void {
  // ── List ─────────────────────────────────────────────────────────────────────
  app.get('/api/api-keys', (c) => {
    const keys = listApiKeys(BRAND)
    return c.json({ keys })
  })

  // ── Create ───────────────────────────────────────────────────────────────────
  app.post('/api/api-keys', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json() as Record<string, unknown>
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { name, scopes, expires_at } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ error: 'name is required' }, 400)
    }
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return c.json({ error: 'scopes must be a non-empty array' }, 400)
    }

    const result = createApiKey(BRAND, {
      name: name.trim(),
      scopes: scopes as string[],
      expires_at: typeof expires_at === 'string' && expires_at ? expires_at : undefined,
    })

    return c.json(result, 201)
  })

  // ── Revoke ───────────────────────────────────────────────────────────────────
  app.delete('/api/api-keys/:id/revoke', (c) => {
    const id = c.req.param('id')
    const ok = revokeApiKey(BRAND, id)
    if (!ok) return c.json({ error: 'Key not found' }, 404)
    return c.json({ success: true })
  })

  // ── Delete ───────────────────────────────────────────────────────────────────
  app.delete('/api/api-keys/:id', (c) => {
    const id = c.req.param('id')
    const ok = deleteApiKey(BRAND, id)
    if (!ok) return c.json({ error: 'Key not found' }, 404)
    return c.json({ success: true })
  })
}
