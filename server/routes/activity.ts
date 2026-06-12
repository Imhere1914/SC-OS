import type { Hono } from 'hono'
import {
  appendActivity,
  listActivities,
  getActivityStats,
  type ActivityType,
} from '../stores/activity-store'
import { getBrandId } from '../lib/brand'
import { paginate, paginationParams } from '../lib/paginate'

export function registerActivity(app: Hono) {
  // GET /api/activity — list events
  app.get('/api/activity', (c) => {
    const brand = getBrandId(c)
    const type = c.req.query('type') as ActivityType | undefined
    const entity_type = c.req.query('entity_type') ?? undefined
    const entity_id = c.req.query('entity_id') ?? undefined
    const from = c.req.query('from') ?? undefined
    const to = c.req.query('to') ?? undefined
    const { limit, offset } = paginationParams({ limit: c.req.query('limit'), offset: c.req.query('offset') })

    // Fetch all matching records so paginate() can compute accurate total
    const allActivities = listActivities(brand, { type, entity_type, entity_id, from, to, limit: Number.MAX_SAFE_INTEGER })
    const paginatedResult = paginate(allActivities, limit, offset)
    return c.json({ activities: paginatedResult.data, total: paginatedResult.total, has_more: paginatedResult.has_more })
  })

  // GET /api/activity/stats — counts by type in last 30 days
  app.get('/api/activity/stats', (c) => {
    const brand = getBrandId(c)
    const stats = getActivityStats(brand)
    return c.json({ stats })
  })

  // POST /api/activity — append a new activity record
  app.post('/api/activity', async (c) => {
    const body = await c.req.json()
    if (!body.type) return c.json({ error: 'type required' }, 400)
    if (!body.message?.trim()) return c.json({ error: 'message required' }, 400)

    const brand = body.brand ?? getBrandId(c)
    const record = appendActivity(brand, {
      type: body.type,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      entity_name: body.entity_name,
      actor: body.actor ?? 'system',
      message: body.message,
      metadata: body.metadata,
      icon: body.icon,
    })
    return c.json(record, 201)
  })
}
