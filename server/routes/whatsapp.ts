import type { Hono } from 'hono'
import { isWhatsAppConfigured, parseWhatsAppWebhook, sendWhatsApp } from '../lib/whatsapp'
import {
  addMessage,
  createConversation,
  findOpenConversationByContact,
} from '../stores/conversations-store'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerWhatsApp(app: Hono): void {
  // ── GET /api/whatsapp/status ──────────────────────────────────────────────
  app.get('/api/whatsapp/status', (c) => {
    return c.json({
      configured: isWhatsAppConfigured(),
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    })
  })

  // ── POST /api/whatsapp/send ───────────────────────────────────────────────
  app.post('/api/whatsapp/send', async (c) => {
    if (!isWhatsAppConfigured()) {
      return c.json(
        {
          ok: false,
          error: 'WhatsApp not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your environment.',
        },
        502,
      )
    }

    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const to = typeof b.to === 'string' ? b.to.trim() : ''
    const body = typeof b.body === 'string' ? b.body.trim() : ''
    const contactId = typeof b.contact_id === 'string' ? b.contact_id : null
    const contactName = typeof b.contact_name === 'string' ? b.contact_name : null

    if (!to) return c.json({ ok: false, error: 'to is required' }, 400)
    if (!body) return c.json({ ok: false, error: 'body is required' }, 400)

    const existingConv = contactId
      ? findOpenConversationByContact(contactId, 'whatsapp')
      : null

    const conv = existingConv ?? createConversation({
      contact_id: contactId,
      contact_name: contactName ?? to,
      channel: 'whatsapp',
      subject: `WhatsApp to ${to}`,
    })

    const result = await sendWhatsApp(to, body)

    addMessage(conv.id, {
      role: 'human',
      body,
      author: 'agent',
      draft: false,
    })

    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 502)
    }

    return c.json({ ok: true, message_id: result.message_id, conversation_id: conv.id })
  })

  // ── GET /api/whatsapp/webhook — verification handshake ────────────────────
  app.get('/api/whatsapp/webhook', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? 'ai-os-whatsapp'
    if (mode === 'subscribe' && token === verifyToken) {
      return c.text(challenge ?? '', 200)
    }
    return c.json({ error: 'Forbidden' }, 403)
  })

  // ── POST /api/whatsapp/webhook — inbound messages ─────────────────────────
  // Meta hits this endpoint directly — no auth required beyond verify token
  app.post('/api/whatsapp/webhook', async (c) => {
    let body: Record<string, unknown> = {}
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: true }) // always 200 to Meta
    }

    const parsed = parseWhatsAppWebhook(body)

    if (parsed) {
      const { from, text, displayName } = parsed
      const contactName = displayName ?? from

      const existingConv = findOpenConversationByContact(from, 'whatsapp')

      const conv = existingConv ?? createConversation({
        contact_id: from,
        contact_name: contactName,
        channel: 'whatsapp',
        subject: `WhatsApp from ${contactName}`,
      })

      addMessage(conv.id, {
        role: 'contact',
        body: text,
        author: contactName,
        draft: false,
      })

      appendNotification({
        brand: BRAND,
        message: `New WhatsApp from ${contactName}`,
        context_summary: text.length > 80 ? text.slice(0, 80) + '…' : text,
      })
    }

    // Meta requires a 200 response
    return c.json({ ok: true })
  })
}
