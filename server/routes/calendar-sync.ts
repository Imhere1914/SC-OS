import type { Hono } from 'hono'
import { getCalendarSync, upsertCalendarSync } from '../stores/calendar-sync-store'

export function registerCalendarSync(app: Hono) {
  // GET /api/calendar-sync — fetch config for brand
  app.get('/api/calendar-sync', (c) => {
    const brand = c.req.query('brand')
    return c.json(getCalendarSync(brand))
  })

  // PUT /api/calendar-sync — upsert config
  app.put('/api/calendar-sync', async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>
    const brand = (typeof body.brand === 'string' ? body.brand : c.req.query('brand')) ?? 'default'
    const patch: Record<string, unknown> = { ...body }
    delete patch.brand
    const updated = upsertCalendarSync(brand, patch as Parameters<typeof upsertCalendarSync>[1])
    return c.json(updated)
  })

  // POST /api/calendar-sync/connect — mock Google OAuth connect
  app.post('/api/calendar-sync/connect', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = (typeof body.brand === 'string' ? body.brand : c.req.query('brand')) ?? 'default'
    upsertCalendarSync(brand, { google_connected: true })
    return c.json({ ok: true, message: 'Connected' })
  })

  // POST /api/calendar-sync/disconnect — clear connection
  app.post('/api/calendar-sync/disconnect', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = (typeof body.brand === 'string' ? body.brand : c.req.query('brand')) ?? 'default'
    upsertCalendarSync(brand, { google_connected: false, calendar_id: null, enabled: false })
    return c.json({ ok: true, message: 'Disconnected' })
  })

  // POST /api/calendar-sync/test — mock test sync
  app.post('/api/calendar-sync/test', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = (typeof body.brand === 'string' ? body.brand : c.req.query('brand')) ?? 'default'
    const synced = Math.floor(Math.random() * 6) + 1
    upsertCalendarSync(brand, { last_synced_at: new Date().toISOString() })
    return c.json({ synced, message: `Sync test successful — ${synced} events checked` })
  })
}
