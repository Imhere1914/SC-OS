/**
 * Webhook handlers — Stripe and future integrations.
 *
 * Stripe setup:
 *   1. Set STRIPE_WEBHOOK_SECRET in .env (from Stripe dashboard → Webhooks)
 *   2. Point the Stripe webhook to: POST https://<your-domain>/api/webhooks/stripe
 *   3. Enable events: payment_intent.succeeded, invoice.paid, invoice.payment_failed
 */
import type { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { listContacts } from '../stores/contacts-store'

const BRAND = process.env.BRAND ?? 'default'

// ── Stripe signature verification ────────────────────────────────────────────

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
    const timestamp = parts['t']
    const sig = parts['v1']
    if (!timestamp || !sig) return false

    const signed = `${timestamp}.${payload}`
    const expected = createHmac('sha256', secret).update(signed, 'utf8').digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf   = Buffer.from(sig, 'hex')
    if (expectedBuf.length !== actualBuf.length) return false
    return timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

type StripeEvent = {
  type: string
  data: { object: Record<string, unknown> }
}

function handlePaymentIntentSucceeded(obj: Record<string, unknown>) {
  const amount = typeof obj.amount === 'number' ? (obj.amount / 100).toFixed(2) : '?'
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : 'USD'
  const email = (obj.receipt_email ?? obj.customer_email) as string | undefined

  // Try to match to a contact by email
  let contactId: string | undefined
  if (email) {
    const contact = listContacts({}).find(c => c.email?.toLowerCase() === email.toLowerCase())
    if (contact) {
      contactId = contact.id
      appendActivity({
        contact_id: contact.id,
        type: 'invoice_paid',
        description: `Payment received: ${currency} ${amount}`,
        meta: { source: 'stripe', amount: String(obj.amount), currency: obj.currency as string },
      })
    }
  }

  appendNotification({
    brand: BRAND,
    message: `Payment received: ${currency} ${amount}`,
    context_summary: email ?? (contactId ? 'Matched contact' : 'Unknown customer'),
  })
}

function handleInvoicePaid(obj: Record<string, unknown>) {
  const amount = typeof obj.amount_paid === 'number' ? (obj.amount_paid / 100).toFixed(2) : '?'
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : 'USD'
  const email = (obj.customer_email) as string | undefined
  const invoiceNumber = typeof obj.number === 'string' ? obj.number : undefined

  if (email) {
    const contact = listContacts({}).find(c => c.email?.toLowerCase() === email.toLowerCase())
    if (contact) {
      appendActivity({
        contact_id: contact.id,
        type: 'invoice_paid',
        description: `Invoice paid${invoiceNumber ? ` (${invoiceNumber})` : ''}: ${currency} ${amount}`,
        meta: { source: 'stripe', ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}) },
      })
    }
  }

  appendNotification({
    brand: BRAND,
    message: `Invoice paid${invoiceNumber ? ` #${invoiceNumber}` : ''}: ${currency} ${amount}`,
    context_summary: email ?? 'Unknown customer',
  })
}

function handleInvoicePaymentFailed(obj: Record<string, unknown>) {
  const email = (obj.customer_email) as string | undefined
  const amount = typeof obj.amount_due === 'number' ? (obj.amount_due / 100).toFixed(2) : '?'
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : 'USD'

  if (email) {
    const contact = listContacts({}).find(c => c.email?.toLowerCase() === email.toLowerCase())
    if (contact) {
      appendActivity({
        contact_id: contact.id,
        type: 'custom',
        description: `Invoice payment failed: ${currency} ${amount}`,
        meta: { source: 'stripe' },
      })
    }
  }

  appendNotification({
    brand: BRAND,
    message: `⚠️ Payment failed: ${currency} ${amount}`,
    context_summary: email ?? 'Unknown customer',
  })
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerWebhooks(app: Hono): void {
  app.post('/api/webhooks/stripe', async (c) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    const body = await c.req.text()
    const sigHeader = c.req.header('stripe-signature') ?? ''

    // If secret is set, verify signature
    if (secret) {
      if (!sigHeader) return c.json({ error: 'Missing stripe-signature header' }, 400)
      if (!verifyStripeSignature(body, sigHeader, secret)) {
        return c.json({ error: 'Invalid signature' }, 401)
      }
    }

    let event: StripeEvent
    try {
      event = JSON.parse(body) as StripeEvent
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const obj = event.data?.object ?? {}

    switch (event.type) {
      case 'payment_intent.succeeded':
        handlePaymentIntentSucceeded(obj)
        break
      case 'invoice.paid':
        handleInvoicePaid(obj)
        break
      case 'invoice.payment_failed':
        handleInvoicePaymentFailed(obj)
        break
      default:
        // Acknowledge but ignore other event types
        break
    }

    return c.json({ received: true })
  })

  // Integration status endpoint
  app.get('/api/integrations/status', (c) => {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.CAMPAIGN_FROM_EMAIL?.trim()
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

    return c.json({
      brand: process.env.BRAND ?? 'default',
      resend: {
        configured: !!(resendKey && fromEmail),
        from: fromEmail ?? null,
        note: resendKey && fromEmail ? `Sending from ${fromEmail}` : 'Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL to enable email',
      },
      stripe: {
        configured: !!stripeSecret,
        note: stripeSecret ? 'Webhook secret configured' : 'Set STRIPE_WEBHOOK_SECRET to verify webhook signatures',
      },
      openrouter: {
        configured: !!openrouterKey,
        note: openrouterKey ? 'AI features enabled' : 'Set OPENROUTER_API_KEY to enable AI features (offline fallback is active)',
      },
      google_calendar: {
        configured: !!(googleClientId && googleClientSecret),
        note: googleClientId && googleClientSecret ? 'OAuth credentials configured' : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable calendar sync',
      },
    })
  })
}
