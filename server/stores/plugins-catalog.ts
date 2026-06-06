/**
 * Plugins catalog — the integrations the AI OS supports. Static definitions
 * shared by the Plugins screen and the API. Enabled/config state per brand
 * lives in the plugins-store; this is the menu of what's available.
 */

export type PluginCategory =
  | 'messaging'
  | 'email'
  | 'social'
  | 'calendar'
  | 'voice'
  | 'payments'
  | 'ai'

export type PluginStatus = 'available' | 'beta' | 'coming_soon'

export type PluginDef = {
  id: string
  name: string
  description: string
  category: PluginCategory
  emoji: string
  status: PluginStatus
  /** Env vars that must be set for this plugin to function. */
  env_vars: string[]
  /** Short setup hint. */
  setup: string
}

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
  messaging: 'Messaging',
  email: 'Email',
  social: 'Social',
  calendar: 'Calendar',
  voice: 'Voice',
  payments: 'Payments',
  ai: 'AI',
}

export const PLUGINS: PluginDef[] = [
  {
    id: 'twilio-sms',
    name: 'Twilio SMS',
    description: 'Two-way SMS — inbound lands in Conversations, replies send back.',
    category: 'messaging',
    emoji: '💬',
    status: 'available',
    env_vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    setup: 'Set Twilio webhook → /api/channels/sms',
  },
  {
    id: 'meta-whatsapp',
    name: 'WhatsApp (Meta)',
    description: 'WhatsApp Business inbound/outbound via the Meta Cloud API.',
    category: 'messaging',
    emoji: '🟢',
    status: 'available',
    env_vars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
    setup: 'Set Meta webhook → /api/channels/whatsapp',
  },
  {
    id: 'webchat',
    name: 'Web Chat Widget',
    description: 'Embeddable chat widget for landing pages → creates contacts.',
    category: 'messaging',
    emoji: '🗨️',
    status: 'available',
    env_vars: [],
    setup: 'Embed /widget?brand=… as an iframe',
  },
  {
    id: 'resend-email',
    name: 'Resend Email',
    description: 'Send email campaigns + transactional email.',
    category: 'email',
    emoji: '📧',
    status: 'available',
    env_vars: ['RESEND_API_KEY', 'CAMPAIGN_FROM_EMAIL'],
    setup: 'Add a verified sender domain in Resend',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read inbox + draft replies (agent drafts, human sends).',
    category: 'email',
    emoji: '✉️',
    status: 'available',
    env_vars: [],
    setup: 'Connect via the Google MCP (per instance)',
  },
  {
    id: 'zernio-social',
    name: 'Zernio / Blotato',
    description: 'Publish to Instagram, Facebook, TikTok, LinkedIn, X.',
    category: 'social',
    emoji: '📣',
    status: 'available',
    env_vars: ['ZERNIO_API_KEY'],
    setup: 'Or set BLOTATO_API_KEY to use Blotato',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Read availability + sync appointments (write coming).',
    category: 'calendar',
    emoji: '📅',
    status: 'beta',
    env_vars: [],
    setup: 'Connect via the Google MCP; write scope pending',
  },
  {
    id: 'retell-voice',
    name: 'Retell / Vapi Voice',
    description: 'AI phone line — inbound + outbound calls.',
    category: 'voice',
    emoji: '📞',
    status: 'coming_soon',
    env_vars: ['RETELL_API_KEY', 'TWILIO_PHONE_NUMBER'],
    setup: 'SC first; HFM gated on HIPAA/BAA',
  },
  {
    id: 'neutts-voice',
    name: 'NeuTTS Voice',
    description: 'Generate spoken audio (briefs, voiceovers) from text.',
    category: 'voice',
    emoji: '🔊',
    status: 'beta',
    env_vars: [],
    setup: 'Server-side TTS via the hermes agent',
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    description: 'Invoices, payment links, subscription billing.',
    category: 'payments',
    emoji: '💳',
    status: 'coming_soon',
    env_vars: ['STRIPE_SECRET_KEY'],
    setup: 'Planned — invoicing + payment links',
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    description: 'The AI brain — drafts replies, generates content, qualifies leads.',
    category: 'ai',
    emoji: '🧠',
    status: 'available',
    env_vars: [],
    setup: 'Always on (per-instance gateway)',
  },
  {
    id: 'image-gen',
    name: 'Image / Video Gen',
    description: 'Generate branded images + short video for social/content.',
    category: 'ai',
    emoji: '🎨',
    status: 'available',
    env_vars: [],
    setup: 'Via hermes image_gen + ComfyUI (HFM)',
  },
]

export const STATUS_LABELS: Record<PluginStatus, string> = {
  available: 'Available',
  beta: 'Beta',
  coming_soon: 'Coming soon',
}
