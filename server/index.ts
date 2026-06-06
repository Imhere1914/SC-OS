import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { registerContacts } from './routes/contacts'
import { registerConversations } from './routes/conversations'
import { registerAppointments } from './routes/appointments'
import { registerSocial } from './routes/social'
import { registerCampaigns } from './routes/campaigns'
import { registerProjects } from './routes/projects'
import { registerPages } from './routes/pages'
import { registerTemplates } from './routes/templates'
import { registerAvatars } from './routes/avatars'
import { registerPlugins } from './routes/plugins'
import { registerHighlights } from './routes/highlights'
import { registerMedia } from './routes/media'
import { registerChat } from './routes/chat'
import { registerKnowledge } from './routes/knowledge'
import { registerProjectTasks } from './routes/project-tasks'
import { registerStats } from './routes/stats'
import { registerAutomations } from './routes/automations'
import { registerCalendar } from './routes/calendar'
import { registerStrategy } from './routes/strategy'
import { registerForms } from './routes/forms'
import { registerAvailability } from './routes/availability'
import { registerInvoices } from './routes/invoices'
import { registerContactDetail } from './routes/contact-detail'
import { registerReports } from './routes/reports'
import { registerNotifications } from './routes/notifications'
import { isEmailConfigured } from './stores/email-sender'

const app = new Hono()

const BRANDS: Record<string, { id: string; name: string; shortName: string; accentColor: string }> = {
  sc: { id: 'sc', name: 'SC Intelligence', shortName: 'SC', accentColor: '#2f6df6' },
  hfm: { id: 'hfm', name: 'HFM Intelligence', shortName: 'HFM', accentColor: '#7c6f9b' },
  default: { id: 'default', name: 'AI OS', shortName: 'OS', accentColor: '#2f6df6' },
}

app.get('/api/email-status', (c) => {
  const configured = isEmailConfigured()
  return c.json({
    configured,
    from: process.env.CAMPAIGN_FROM_EMAIL?.trim() || null,
    note: configured ? 'Resend is live' : 'Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL in .env to enable email sending',
  })
})

app.get('/api/brand', (c) => {
  const id = (process.env.BRAND ?? 'default').toLowerCase()
  return c.json(BRANDS[id] ?? BRANDS.default)
})
app.get('/api/health', (c) => c.json({ ok: true }))

registerContacts(app)
registerConversations(app)
registerAppointments(app)
registerSocial(app)
registerCampaigns(app)
registerProjects(app)
registerPages(app)
registerTemplates(app)
registerAvatars(app)
registerPlugins(app)
registerHighlights(app)
registerMedia(app)
registerChat(app)
registerKnowledge(app)
registerProjectTasks(app)
registerStats(app)
registerAutomations(app)
registerCalendar(app)
registerStrategy(app)
registerForms(app)
registerAvailability(app)
registerInvoices(app)
registerContactDetail(app)
registerReports(app)
registerNotifications(app)

// ── Static file serving (production) ────────────────────────────────────────
// In dev, Vite serves the frontend on :4321. In production (SERVE_STATIC=true
// or NODE_ENV=production), the Hono server also serves dist/ and falls back
// to index.html for SPA routing.
const isProd = process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production'
const distDir = resolve(process.env.DIST_DIR ?? join(process.cwd(), 'dist'))

if (isProd && existsSync(distDir)) {
  // Serve hashed assets with long cache
  app.use('/assets/*', serveStatic({ root: distDir }))
  // Serve other static files (favicon, etc.)
  app.use('/*', serveStatic({ root: distDir }))
  // SPA fallback — any unmatched route serves index.html
  app.get('*', (c) => {
    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    return c.html(html)
  })
  console.log(`[ai-os] Serving static files from ${distDir}`)
}

const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: app.fetch, port })
console.log(`[ai-os] Listening on http://localhost:${port} (brand: ${process.env.BRAND ?? 'default'})`)
