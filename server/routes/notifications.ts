/**
 * Notifications API
 * GET  /api/notifications?brand=&unread_only=true
 * POST /api/notifications/:id/read
 * POST /api/notifications/read-all?brand=
 */
import type { Hono } from 'hono'
import {
  appendNotification,
  listNotifications,
  markAllRead,
  markRead,
} from '../stores/notifications-store'

export function registerNotifications(app: Hono): void {
  app.get('/api/notifications', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? undefined
    const unreadOnly = url.searchParams.get('unread_only') === 'true'
    const items = listNotifications({ brand, unread_only: unreadOnly })
    const unreadCount = listNotifications({ brand, unread_only: true }).length
    return c.json({ notifications: items, unread_count: unreadCount })
  })

  app.post('/api/notifications/:id/read', (c) => {
    const id = c.req.param('id')
    const ok = markRead(id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/notifications/read-all', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? (process.env.BRAND ?? 'default')
    markAllRead(brand)
    return c.json({ ok: true })
  })

  // Internal endpoint to push a notification (can be called from other routes)
  app.post('/api/notifications', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.message || typeof body.message !== 'string') {
      return c.json({ error: 'message required' }, 400)
    }
    appendNotification({
      brand: typeof body.brand === 'string' ? body.brand : (process.env.BRAND ?? 'default'),
      message: body.message,
      context_summary: typeof body.context_summary === 'string' ? body.context_summary : '',
    })
    return c.json({ ok: true }, 201)
  })
}
