import type { Hono } from 'hono'
import { isTwilioConfigured, parseTwilioWebhook, sendSms } from '../lib/twilio'
import {
  addMessage,
  createConversation,
  findOpenConversationByContact,
} from '../stores/conversations-store'

export function registerSms(app: Hono): void {
  // ── GET /api/sms/status ───────────────────────────────────────────────────
  app.get('/api/sms/status', (c) => {
    return c.json({
      configured: isTwilioConfigured(),
      from: process.env.TWILIO_PHONE_NUMBER?.trim() || null,
    })
  })

  // ── POST /api/sms/send ────────────────────────────────────────────────────
  app.post('/api/sms/send', async (c) => {
    if (!isTwilioConfigured()) {
      return c.json(
        {
          ok: false,
          error:
            'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment.',
        },
        502,
      )
    }

    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const to = typeof b.to === 'string' ? b.to.trim() : ''
    const body = typeof b.body === 'string' ? b.body.trim() : ''
    const contactId =
      typeof b.contact_id === 'string' ? b.contact_id : null
    const contactName =
      typeof b.contact_name === 'string' ? b.contact_name : null

    if (!to) return c.json({ ok: false, error: 'to is required' }, 400)
    if (!body) return c.json({ ok: false, error: 'body is required' }, 400)

    // Find or create the conversation for this phone number
    const existingConv =
      contactId
        ? findOpenConversationByContact(contactId, 'sms')
        : null

    const conv =
      existingConv ??
      createConversation({
        contact_id: contactId,
        contact_name: contactName ?? to,
        channel: 'sms',
        subject: `SMS to ${to}`,
      })

    // Actually send the SMS
    const result = await sendSms(to, body)

    // Record the outbound message regardless (even if Twilio failed, keep a record)
    addMessage(conv.id, {
      role: 'human',
      body,
      author: 'agent',
      draft: false,
    })

    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 502)
    }

    return c.json({ ok: true, sid: result.sid, conversation_id: conv.id })
  })

  // ── POST /api/sms/webhook ─────────────────────────────────────────────────
  // Twilio hits this endpoint directly — no auth required.
  app.post('/api/sms/webhook', async (c) => {
    // Twilio sends application/x-www-form-urlencoded
    let formBody: Record<string, string> = {}
    try {
      const text = await c.req.text()
      const params = new URLSearchParams(text)
      for (const [k, v] of params.entries()) {
        formBody[k] = v
      }
    } catch {
      // fall through — parseTwilioWebhook will return null
    }

    const parsed = parseTwilioWebhook(formBody)

    if (parsed) {
      const { from, body, sid } = parsed

      // Use the caller's phone number as the contact identifier
      const existingConv = findOpenConversationByContact(from, 'sms')

      const conv =
        existingConv ??
        createConversation({
          contact_id: from,
          contact_name: from,
          channel: 'sms',
          subject: `SMS from ${from}`,
        })

      addMessage(conv.id, {
        role: 'contact',
        body,
        author: from,
        draft: false,
      })

      addMessage(conv.id, {
        role: 'system',
        body: `New SMS from ${from} (SID: ${sid})`,
        author: null,
        draft: false,
      })
    }

    // Always return valid TwiML — empty response means no auto-reply
    return c.text('<Response></Response>', 200, {
      'Content-Type': 'text/xml',
    })
  })
}
