import type { Hono } from 'hono'
import { getOrCreateVapidKeys } from '../lib/vapid'
import { savePushSubscription, removePushSubscription, listPushSubscriptions } from '../stores/push-store'
import { sendPushToAll } from '../lib/push-sender'

export function registerPush(app: Hono) {
  // GET /api/push/vapid-public-key
  app.get('/api/push/vapid-public-key', (c) => {
    const { publicKey } = getOrCreateVapidKeys()
    return c.json({ publicKey })
  })

  // POST /api/push/subscribe
  app.post('/api/push/subscribe', async (c) => {
    const brand = (process.env.BRAND ?? 'default').toLowerCase()
    const body = await c.req.json<{
      endpoint: string
      keys: { auth: string; p256dh: string }
      user_agent?: string
    }>()
    if (!body.endpoint || !body.keys?.auth || !body.keys?.p256dh) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    const sub = savePushSubscription(brand, {
      brand,
      endpoint: body.endpoint,
      keys: body.keys,
      user_agent: body.user_agent,
    })
    return c.json({ ok: true, id: sub.id })
  })

  // DELETE /api/push/unsubscribe
  app.delete('/api/push/unsubscribe', async (c) => {
    const brand = (process.env.BRAND ?? 'default').toLowerCase()
    const body = await c.req.json<{ endpoint: string }>()
    if (!body.endpoint) {
      return c.json({ error: 'Missing endpoint' }, 400)
    }
    removePushSubscription(brand, body.endpoint)
    return c.json({ ok: true })
  })

  // POST /api/push/test
  app.post('/api/push/test', async (c) => {
    const brand = (process.env.BRAND ?? 'default').toLowerCase()
    const result = await sendPushToAll(brand, {
      title: 'Test notification',
      body: 'Push notifications are working!',
    })
    return c.json({ ok: true, ...result })
  })

  // GET /api/push/status
  app.get('/api/push/status', (c) => {
    const brand = (process.env.BRAND ?? 'default').toLowerCase()
    const subs = listPushSubscriptions(brand)
    return c.json({ subscriptions: subs.length, vapid_configured: true })
  })
}
