import type { Hono } from 'hono'
import { getCalendarSync } from '../stores/calendar-sync-store'

// ── Types ────────────────────────────────────────────────────────────────────

export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export interface IntegrationInfo {
  id: string
  name: string
  description: string
  category: 'email' | 'payments' | 'sms' | 'calendar' | 'ai' | 'storage' | 'crm' | 'analytics'
  status: IntegrationStatus
  detail: string | null
  docs_url: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

// ── Snapshot builder ─────────────────────────────────────────────────────────

function buildIntegrations(brand?: string): IntegrationInfo[] {
  // Resend (email)
  const resendKey = env('RESEND_API_KEY')
  const fromEmail = env('CAMPAIGN_FROM_EMAIL')
  const resendConnected = !!(resendKey && fromEmail)

  // Stripe (payments)
  const stripeKey = env('STRIPE_SECRET_KEY')
  let stripeDetail: string | null = null
  if (stripeKey) {
    const isLive = stripeKey.startsWith('sk_live_')
    const prefix = stripeKey.slice(0, 14) + '...'
    stripeDetail = `${isLive ? 'Live' : 'Test'} key — ${prefix}`
  }

  // Twilio (sms)
  const twilioSid = env('TWILIO_ACCOUNT_SID')
  const twilioToken = env('TWILIO_AUTH_TOKEN')
  const twilioPhone = env('TWILIO_PHONE_NUMBER')
  const twilioConnected = !!(twilioSid && twilioToken && twilioPhone)

  // OpenAI / OpenRouter (ai)
  const openaiKey = env('OPENAI_API_KEY')
  const openrouterKey = env('OPENROUTER_API_KEY')
  const openaiConnected = !!(openaiKey || openrouterKey)
  let openaiDetail: string | null = null
  if (openaiKey && openrouterKey) openaiDetail = 'OpenAI + OpenRouter configured'
  else if (openaiKey) openaiDetail = 'OpenAI configured'
  else if (openrouterKey) openaiDetail = 'OpenRouter configured'

  // Google Calendar (calendar)
  let googleCalConnected = false
  let googleCalDetail: string | null = null
  try {
    const calSync = getCalendarSync(brand)
    googleCalConnected = calSync.google_connected === true
    if (googleCalConnected) {
      googleCalDetail = calSync.calendar_id
        ? `Calendar ID: ${calSync.calendar_id}`
        : 'Connected — no calendar selected'
    }
  } catch {
    // store not available — treat as not configured
  }

  // Anthropic (ai)
  const anthropicKey = env('ANTHROPIC_API_KEY')

  // Meta / WhatsApp (sms)
  const waToken = env('WHATSAPP_TOKEN')
  const waPhoneId = env('WHATSAPP_PHONE_NUMBER_ID')
  const waConnected = !!(waToken && waPhoneId)

  return [
    {
      id: 'resend',
      name: 'Resend',
      description: 'Transactional and marketing email delivery with high deliverability.',
      category: 'email',
      status: resendConnected ? 'connected' : 'not_configured',
      detail: resendConnected
        ? `Sending as ${fromEmail}`
        : 'Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL to enable',
      docs_url: 'https://resend.com/docs',
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Accept payments, manage subscriptions, and issue invoices.',
      category: 'payments',
      status: stripeKey ? 'connected' : 'not_configured',
      detail: stripeKey ? stripeDetail : 'Set STRIPE_SECRET_KEY to enable',
      docs_url: 'https://stripe.com/docs/api',
    },
    {
      id: 'twilio',
      name: 'Twilio',
      description: 'Send and receive SMS messages and voice calls.',
      category: 'sms',
      status: twilioConnected ? 'connected' : 'not_configured',
      detail: twilioConnected
        ? `Sending from ${twilioPhone}`
        : 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to enable',
      docs_url: 'https://www.twilio.com/docs/sms',
    },
    {
      id: 'openai',
      name: 'OpenAI / OpenRouter',
      description: 'Power AI features with GPT models or OpenRouter gateway.',
      category: 'ai',
      status: openaiConnected ? 'connected' : 'not_configured',
      detail: openaiConnected ? openaiDetail : 'Set OPENAI_API_KEY or OPENROUTER_API_KEY to enable',
      docs_url: 'https://platform.openai.com/docs',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync appointments and events with Google Calendar.',
      category: 'calendar',
      status: googleCalConnected ? 'connected' : 'not_configured',
      detail: googleCalConnected ? googleCalDetail : 'Connect via Calendar Settings to enable sync',
      docs_url: 'https://developers.google.com/calendar/api/guides/overview',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Use Claude models for AI-powered writing, analysis and automation.',
      category: 'ai',
      status: anthropicKey ? 'connected' : 'not_configured',
      detail: anthropicKey ? 'API key configured' : 'Set ANTHROPIC_API_KEY to enable',
      docs_url: 'https://docs.anthropic.com',
    },
    {
      id: 'whatsapp',
      name: 'Meta / WhatsApp',
      description: 'Send WhatsApp messages via the Meta Business API.',
      category: 'sms',
      status: waConnected ? 'connected' : 'not_configured',
      detail: waConnected
        ? `Phone number ID: ${waPhoneId}`
        : 'Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable',
      docs_url: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    },
  ]
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerIntegrations(app: Hono): void {
  app.get('/api/integrations', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') || undefined
    return c.json(buildIntegrations(brand))
  })
}
