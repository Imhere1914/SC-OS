/**
 * Audit log routes.
 *
 * GET  /api/audit        — list entries with optional filters
 * POST /api/audit        — append an entry (internal/automated use)
 */
import type { Hono } from 'hono'
import { appendAudit, listAudit } from '../stores/audit-store'
import { paginate, paginationParams } from '../lib/paginate'

const BRAND = process.env.BRAND ?? 'default'

export function registerAudit(app: Hono): void {
  // ── List audit entries ───────────────────────────────────────────────────────
  app.get('/api/audit', (c) => {
    const entity_type = c.req.query('entity_type') || undefined
    const actor       = c.req.query('actor')       || undefined
    const from        = c.req.query('from')         || undefined
    const to          = c.req.query('to')           || undefined
    const { limit, offset } = paginationParams({ limit: c.req.query('limit'), offset: c.req.query('offset') })

    // Fetch all matching records so paginate() can compute accurate total
    const allEntries = listAudit(BRAND, { entity_type, actor, from, to, limit: Number.MAX_SAFE_INTEGER })
    const paginatedResult = paginate(allEntries, limit, offset)
    return c.json({ entries: paginatedResult.data, total: paginatedResult.total, has_more: paginatedResult.has_more })
  })

  // ── Append audit entry ───────────────────────────────────────────────────────
  app.post('/api/audit', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json() as Record<string, unknown>
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { actor, action, entity_type, entity_id, entity_label, details } = body

    if (!actor || typeof actor !== 'string') return c.json({ error: 'actor is required' }, 400)
    if (!action || typeof action !== 'string') return c.json({ error: 'action is required' }, 400)
    if (!entity_type || typeof entity_type !== 'string') return c.json({ error: 'entity_type is required' }, 400)

    const ip         = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined
    const user_agent = c.req.header('user-agent') ?? undefined

    const entry = appendAudit(BRAND, {
      brand: BRAND,
      actor,
      action,
      entity_type,
      entity_id:    typeof entity_id    === 'string' ? entity_id    : undefined,
      entity_label: typeof entity_label === 'string' ? entity_label : undefined,
      details:      typeof details === 'object' && details !== null ? details as Record<string, unknown> : undefined,
      ip,
      user_agent,
    })

    return c.json(entry, 201)
  })
}
