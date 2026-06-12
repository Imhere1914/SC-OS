import type { Hono } from 'hono'
import {
  listBroadcasts,
  getBroadcast,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
} from '../stores/broadcast-store'
import type { BroadcastChannel } from '../stores/broadcast-store'
import { listContacts } from '../stores/contacts-store'
import type { ContactRecord } from '../stores/contacts-store'
import { getSegment } from '../stores/segments-store'
import { sendWhatsApp } from '../lib/whatsapp'

// ── helpers ───────────────────────────────────────────────────────────────────

function getBrandFromReq(url: string, fallback: string): string {
  const b = new URL(url).searchParams.get('brand')
  return b || fallback
}

function resolveContacts(
  brand: string,
  segment_id?: string,
  target_tags?: string[],
): ContactRecord[] {
  // contacts-store uses the BRAND env, so we pass a brand filter via tags
  // We read all contacts for this brand from listContacts (it uses process.env.BRAND)
  // For multi-brand setups we filter by brand field manually
  const all = listContacts({}).filter(c => {
    if (c.brand && c.brand !== brand) return false
    return !!c.phone
  })

  if (!segment_id && (!target_tags || target_tags.length === 0)) return all

  // Resolve tags from segment
  let tags: string[] = target_tags ?? []
  if (segment_id) {
    const seg = getSegment(segment_id, brand)
    if (seg) {
      // Collect tag values from segment filters
      const segTags = seg.filters
        .filter(f => f.field === 'tags' && f.value)
        .map(f => f.value as string)
      tags = [...new Set([...tags, ...segTags])]
    }
  }

  if (tags.length === 0) return all
  return all.filter(c => tags.some(t => c.tags.includes(t)))
}

function substituteVars(body: string, contact: ContactRecord): string {
  const nameParts = contact.name.trim().split(/\s+/)
  const firstName = nameParts[0] ?? contact.name
  const fullName = contact.name
  return body
    .replace(/\{\{contact_name\}\}/g, fullName)
    .replace(/\{\{first_name\}\}/g, firstName)
}

async function sendSms(phone: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM

  if (!sid || !token || !from) {
    return { ok: false, error: 'Twilio not configured (TWILIO_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM missing)' }
  }

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: from, Body: body }).toString(),
      },
    )
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { message?: string }
      return { ok: false, error: err.message ?? `HTTP ${resp.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerBroadcast(app: Hono): void {
  // GET /api/broadcasts — list
  app.get('/api/broadcasts', (c) => {
    const brand = getBrandFromReq(c.req.url, process.env.BRAND ?? 'default')
    return c.json({ broadcasts: listBroadcasts(brand) })
  })

  // POST /api/broadcasts — create
  app.post('/api/broadcasts', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : (process.env.BRAND ?? 'default')
    if (typeof b.name !== 'string' || !b.name) return c.json({ error: 'name is required' }, 400)
    if (b.channel !== 'sms' && b.channel !== 'whatsapp') return c.json({ error: 'channel must be sms or whatsapp' }, 400)
    const record = createBroadcast({
      brand,
      name: b.name,
      channel: b.channel as BroadcastChannel,
      body: typeof b.body === 'string' ? b.body : '',
      segment_id: typeof b.segment_id === 'string' ? b.segment_id : undefined,
      target_tags: Array.isArray(b.target_tags) ? (b.target_tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
      scheduled_at: typeof b.scheduled_at === 'string' ? b.scheduled_at : undefined,
    })
    return c.json({ broadcast: record }, 201)
  })

  // PATCH /api/broadcasts/:id — update
  app.patch('/api/broadcasts/:id', async (c) => {
    const id = c.req.param('id')
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandFromReq(c.req.url, process.env.BRAND ?? 'default')
    const record = updateBroadcast(id, brand, {
      name: typeof b.name === 'string' ? b.name : undefined,
      channel: b.channel === 'sms' || b.channel === 'whatsapp' ? b.channel : undefined,
      body: typeof b.body === 'string' ? b.body : undefined,
      segment_id: typeof b.segment_id === 'string' ? b.segment_id : undefined,
      target_tags: Array.isArray(b.target_tags) ? (b.target_tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
      status: typeof b.status === 'string' ? (b.status as 'draft' | 'sending' | 'sent' | 'failed') : undefined,
      scheduled_at: typeof b.scheduled_at === 'string' ? b.scheduled_at : undefined,
    })
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json({ broadcast: record })
  })

  // DELETE /api/broadcasts/:id — delete
  app.delete('/api/broadcasts/:id', (c) => {
    const id = c.req.param('id')
    const brand = getBrandFromReq(c.req.url, process.env.BRAND ?? 'default')
    const ok = deleteBroadcast(id, brand)
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })

  // POST /api/broadcasts/:id/send — execute send
  app.post('/api/broadcasts/:id/send', async (c) => {
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof body.brand === 'string' ? body.brand : getBrandFromReq(c.req.url, process.env.BRAND ?? 'default')

    const broadcast = getBroadcast(id, brand)
    if (!broadcast) return c.json({ error: 'Not found' }, 404)
    if (broadcast.status === 'sent') return c.json({ error: 'Already sent' }, 409)

    const contacts = resolveContacts(brand, broadcast.segment_id, broadcast.target_tags)
    const totalRecipients = contacts.length

    updateBroadcast(id, brand, {
      status: 'sending',
      total_recipients: totalRecipients,
      sent_count: 0,
      failed_count: 0,
    })

    let sentCount = 0
    let failedCount = 0

    for (const contact of contacts) {
      if (!contact.phone) { failedCount++; continue }
      const messageBody = substituteVars(broadcast.body, contact)

      let result: { ok: boolean; error?: string }
      if (broadcast.channel === 'sms') {
        result = await sendSms(contact.phone, messageBody)
      } else {
        result = await sendWhatsApp(contact.phone, messageBody)
      }

      if (result.ok) {
        sentCount++
      } else {
        failedCount++
      }

      // Update counts incrementally
      updateBroadcast(id, brand, {
        sent_count: sentCount,
        failed_count: failedCount,
      })
    }

    const finalRecord = updateBroadcast(id, brand, {
      status: 'sent',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    })

    return c.json({ sent: sentCount, failed: failedCount, broadcast: finalRecord })
  })
}
