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
import { registerRecurringInvoices } from './routes/recurring-invoices'
import { registerContactDetail } from './routes/contact-detail'
import { registerReports } from './routes/reports'
import { registerNotifications } from './routes/notifications'
import { registerWebhooks } from './routes/webhooks'
import { registerTeam } from './routes/team'
import { registerReviewRequests } from './routes/review-requests'
import { isEmailConfigured } from './stores/email-sender'
import { startCampaignScheduler } from './lib/campaign-scheduler'
import { registerSequences } from './routes/sequences'
import { registerDeals } from './routes/deals'
import { registerProposals } from './routes/proposals'
import { registerSegments } from './routes/segments'
import { registerSms } from './routes/sms'
import { registerIntegrations } from './routes/integrations'
import { registerWhatsApp } from './routes/whatsapp'
import { registerCalendarSync } from './routes/calendar-sync'
import { registerOnboarding } from './routes/onboarding'
import { registerAffiliates } from './routes/affiliates'
import { registerTracking } from './routes/tracking'
import { registerPortal } from './routes/portal'
import { registerTimeEntries } from './routes/time-entries'
import { registerBroadcast } from './routes/broadcast'
import { registerTickets } from './routes/tickets'
import { registerPush } from './routes/push'
import { registerSurveys } from './routes/surveys'
import { registerCustomFields } from './routes/custom-fields'
import { registerProducts } from './routes/products'
import { registerLoyalty } from './routes/loyalty'
import { registerExpenses } from './routes/expenses'
import { registerGoals } from './routes/goals'
import { registerDocuments } from './routes/documents'
import { registerAudit } from './routes/audit'
import { registerAdmin } from './routes/admin'
import { registerApiKeys } from './routes/api-keys'
import { registerTestimonials } from './routes/testimonials'
import { registerCommissions } from './routes/commissions'
import { registerContracts } from './routes/contracts'
import { registerInventory } from './routes/inventory'
import { registerActivity } from './routes/activity'
import { registerVideoCalls } from './routes/video-calls'
import { registerBranding } from './routes/branding'
import { registerTranscribe } from './routes/transcribe'
import { registerTts } from './routes/tts'
import { registerAgents } from './routes/agents'
import { registerVoicePrefs } from './routes/voice-prefs'
import { registerAccounts } from './routes/accounts'
import { registerVendors } from './routes/vendors'
import { registerBills } from './routes/bills'
import { registerBanking } from './routes/banking'
import { registerPayroll } from './routes/payroll'
import { startSequenceScheduler } from './lib/sequence-scheduler'
import { startWellnessReminderScheduler } from './lib/wellness-reminder-scheduler'
import { startRecurringInvoiceScheduler } from './lib/recurring-invoice-scheduler'
import { initAutomationEngine } from './lib/automation-engine'
import { registerFinancialReports } from './routes/financial-reports'
import { registerSearch } from './routes/search'
import { registerContactIntelligence } from './routes/contact-intelligence'
import { registerMissionControl } from './routes/mission-control'
import { registerBriefing } from './routes/briefing'
import { registerTraining } from './routes/training'
import { registerWellness } from './routes/wellness'
import { registerTeamChat } from './routes/team-chat'
import { registerOrchestrator } from './routes/orchestrator'
import { registerDevAgents } from './routes/dev-agents'
import { registerSelfUpdate } from './routes/self-update'
import { registerSiteStudio } from './routes/site-studio'
import { registerSocialIntel } from './routes/social-intel'
import { registerProspecting } from './routes/prospecting'
import { registerPreferences } from './routes/preferences'
import { startOrchestratorScheduler } from './lib/orchestrator'
import { registerAuth } from './routes/auth'
import { isAuthEnabled, validateSession, parseCookie, SESSION_COOKIE_NAME } from './lib/auth'
import { enforceRateLimit } from './lib/rate-limit'

const app = new Hono()

// ── Auth middleware ──────────────────────────────────────────────────────────
// Protects ALL /api routes except a curated public allowlist. Static files and
// the SPA fallback stay open (the login screen is part of the SPA).
// Disabled entirely when AUTH_EMAIL/AUTH_PASSWORD are unset (local dev).

/** Prefix allowlist — any method. Entries ending in '/' are prefixes; others are exact paths. */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',              // login/logout/me — the frontend needs /me pre-login
  '/api/brand',              // exact — needed pre-login for theming (NOT /api/branding)
  '/api/health',             // exact — uptime checks, returns { ok: true } only
  '/api/admin/',             // has its own x-admin-secret auth (admin.ts requireAdmin)
  '/api/webhooks/',          // Stripe etc. must stay reachable (webhooks.ts)
  '/api/sms/webhook',        // Twilio inbound (sms.ts:77)
  '/api/whatsapp/webhook',   // Meta verify + inbound (whatsapp.ts:70,83)
  '/api/affiliates/track/',  // public referral tracking (affiliates.ts:18)
  '/api/webchat',            // public web chat / lead-capture ingest (page-renderer.tsx)
  '/api/contracts/sign/',    // public contract view + sign by token (contracts.ts:61,78)
  '/api/documents/shared/',  // shared doc lookup by token (documents.ts:39)
  '/api/training/public/',   // public training module by slug (training.ts:149)
  '/api/training/embed/',    // embedded training by token (training.ts:156)
  '/api/wellness/categories',// public wellness category list (wellness.ts)
  '/api/wellness/today',     // patient's daily session + progress summary (wellness.ts)
  '/api/wellness/start',     // create patient token + progress (wellness.ts)
  '/api/wellness/complete',  // complete a session, earn points/streak (wellness.ts)
  '/api/wellness/session/',  // published session for the player (wellness.ts)
  '/api/wellness/progress',  // patient progress by token (wellness.ts)
  '/api/wellness/plan/today',        // patient's daily plan (wellness.ts)
  '/api/wellness/plan/complete-task',// mark a daily-plan task done (wellness.ts)
  '/api/wellness/focus',             // set patient focus-area track (wellness.ts)
  '/api/wellness/focus-areas',       // list wellness-support tracks (wellness.ts)
  '/api/wellness/reminders',         // set daily-reminder opt-in/email by token (wellness.ts)
  '/api/pages/public/',      // published-page lookup for the /p/<slug> renderer (pages.ts:26)
  '/api/testimonials/public',// approved testimonials for embedding (testimonials.ts:17)
  '/api/testimonials/submit',// public testimonial submission (testimonials.ts:23)
  '/api/prospecting/inbound',// exact — M2M lead ingest; does its OWN x-api-key auth (prospecting.ts)
]

/** Method-scoped allowlist — exact regexes so admin CRUD on the same resources stays protected. */
const PUBLIC_API_RULES: { method: string; pattern: RegExp }[] = [
  // /book page (book.$brand.tsx): availability lookup + booking creation
  { method: 'GET', pattern: /^\/api\/availability$/ },
  { method: 'POST', pattern: /^\/api\/appointments$/ },
  // /pay page (pay.$id.tsx): safe public invoice subset + Stripe checkout
  { method: 'GET', pattern: /^\/api\/invoices\/[^/]+\/public$/ },
  { method: 'POST', pattern: /^\/api\/invoices\/[^/]+\/checkout$/ },
  // /proposal page (proposal.$id.tsx): public view, sign, accept/decline
  { method: 'GET', pattern: /^\/api\/proposals\/[^/]+\/public$/ },
  { method: 'POST', pattern: /^\/api\/proposals\/[^/]+\/sign$/ },
  { method: 'POST', pattern: /^\/api\/proposals\/[^/]+\/respond$/ },
  // /survey page (survey.$id.tsx): public survey + response submission
  { method: 'GET', pattern: /^\/api\/surveys\/[^/]+\/public$/ },
  { method: 'POST', pattern: /^\/api\/surveys\/[^/]+\/respond$/ },
  // Public form submission (forms.ts:58) — used by embedded/lead-capture forms
  { method: 'POST', pattern: /^\/api\/forms\/[^/]+\/submit$/ },
  // /learn page (learn-screen.tsx): enrollment + progress
  { method: 'POST', pattern: /^\/api\/training\/enroll$/ },
  { method: 'POST', pattern: /^\/api\/training\/progress$/ },
]

function isPublicApiPath(path: string, method: string, url: URL): boolean {
  for (const p of PUBLIC_API_PREFIXES) {
    if (p.endsWith('/') ? path.startsWith(p) : path === p) return true
  }
  for (const rule of PUBLIC_API_RULES) {
    if (rule.method === method && rule.pattern.test(path)) return true
  }
  // /portal/:token page (portal.$token.tsx) — GET by token only.
  // /api/portal/tokens (admin token management) must stay protected.
  if (method === 'GET' && /^\/api\/portal\/[^/]+$/.test(path) && path !== '/api/portal/tokens') return true
  // Shared document download (docs.$token.tsx) — only when a share token is presented;
  // documents.ts:162 validates the token against the document.
  if (method === 'GET' && /^\/api\/documents\/[^/]+\/download$/.test(path) && url.searchParams.has('token')) return true
  return false
}

// ── Rate limiting for public WRITE endpoints ─────────────────────────────────
// Abuse backstop in front of the unauthenticated write surface. Each rule maps a
// method + path pattern to a per-IP limit. Anything not matched passes straight
// through. Mounted BEFORE the auth middleware so it also covers public paths.
const RATE_LIMIT_RULES: {
  bucket: string
  method: string
  pattern: RegExp
  max: number
  windowMs: number
}[] = [
  { bucket: 'forms_submit', method: 'POST', pattern: /^\/api\/forms\/[^/]+\/submit$/, max: 10, windowMs: 60_000 },
  // /api/webchat is the public lead-capture ingest path (see allowlist).
  { bucket: 'webchat', method: 'POST', pattern: /^\/api\/webchat$/, max: 20, windowMs: 60_000 },
  { bucket: 'wellness_start', method: 'POST', pattern: /^\/api\/wellness\/start$/, max: 10, windowMs: 60_000 },
  { bucket: 'wellness_complete', method: 'POST', pattern: /^\/api\/wellness\/complete$/, max: 60, windowMs: 60_000 },
  { bucket: 'wellness_task', method: 'POST', pattern: /^\/api\/wellness\/plan\/complete-task$/, max: 60, windowMs: 60_000 },
  { bucket: 'wellness_reminders', method: 'POST', pattern: /^\/api\/wellness\/reminders$/, max: 10, windowMs: 60_000 },
  { bucket: 'testimonials_submit', method: 'POST', pattern: /^\/api\/testimonials\/submit$/, max: 5, windowMs: 60_000 },
  { bucket: 'surveys_respond', method: 'POST', pattern: /^\/api\/surveys\/[^/]+\/respond$/, max: 10, windowMs: 60_000 },
  { bucket: 'appointments_create', method: 'POST', pattern: /^\/api\/appointments$/, max: 10, windowMs: 60_000 },
  { bucket: 'prospecting_inbound', method: 'POST', pattern: /^\/api\/prospecting\/inbound$/, max: 120, windowMs: 60_000 },
  { bucket: 'proposal_sign', method: 'POST', pattern: /^\/api\/proposals\/[^/]+\/sign$/, max: 10, windowMs: 60_000 },
  { bucket: 'proposal_respond', method: 'POST', pattern: /^\/api\/proposals\/[^/]+\/respond$/, max: 10, windowMs: 60_000 },
  { bucket: 'contract_sign', method: 'POST', pattern: /^\/api\/contracts\/sign\/[^/]+$/, max: 10, windowMs: 60_000 },
]

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  const method = c.req.method
  for (const rule of RATE_LIMIT_RULES) {
    if (rule.method === method && rule.pattern.test(path)) {
      const limited = enforceRateLimit(c, rule.bucket, rule.max, rule.windowMs)
      if (limited) return limited
      break
    }
  }
  return next()
})

app.use('/api/*', async (c, next) => {
  if (!isAuthEnabled()) return next()
  const url = new URL(c.req.url)
  if (isPublicApiPath(url.pathname, c.req.method, url)) return next()
  const token = parseCookie(c.req.header('cookie') ?? '', SESSION_COOKIE_NAME)
  if (token && validateSession(token)) return next()
  return c.json({ error: 'Unauthorized' }, 401)
})

const BRANDS: Record<string, { id: string; name: string; shortName: string; accentColor: string }> = {
  sc: { id: 'sc', name: 'Simple Connect', shortName: 'SC', accentColor: '#22c55e' },
  hfm: { id: 'hfm', name: 'Holistic Functional Care', shortName: 'HFM', accentColor: '#a3843b' },
  default: { id: 'default', name: 'AI OS', shortName: 'OS', accentColor: '#22c55e' },
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

registerAuth(app)
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
registerRecurringInvoices(app)
registerContactDetail(app)
registerReports(app)
registerNotifications(app)
registerWebhooks(app)
registerTeam(app)
registerReviewRequests(app)
registerSequences(app)
registerDeals(app)
registerProposals(app)
registerSegments(app)
registerSms(app)
registerIntegrations(app)
registerWhatsApp(app)
registerCalendarSync(app)
registerOnboarding(app)
registerAffiliates(app)
registerTracking(app)
registerPortal(app)
registerTimeEntries(app)
registerBroadcast(app)
registerTickets(app)
registerPush(app)
registerSurveys(app)
registerCustomFields(app)
registerProducts(app)
registerLoyalty(app)
registerExpenses(app)
registerGoals(app)
registerDocuments(app)
registerAudit(app)
registerAdmin(app)
registerApiKeys(app)
registerTestimonials(app)
registerCommissions(app)
registerContracts(app)
registerInventory(app)
registerActivity(app)
registerVideoCalls(app)
registerBranding(app)
registerTranscribe(app)
registerTts(app)
registerAgents(app)
registerVoicePrefs(app)
registerAccounts(app)
registerVendors(app)
registerBills(app)
registerBanking(app)
registerFinancialReports(app)
registerPayroll(app)
registerSearch(app)
registerContactIntelligence(app)
registerMissionControl(app)
registerBriefing(app)
registerTraining(app)
registerWellness(app)
registerTeamChat(app)
registerOrchestrator(app)
registerDevAgents(app)
registerSelfUpdate(app)
registerSiteStudio(app)
registerSocialIntel(app)
registerProspecting(app)
registerPreferences(app)

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
startCampaignScheduler()
startSequenceScheduler()
startWellnessReminderScheduler()
startRecurringInvoiceScheduler()
initAutomationEngine(process.env.BRAND ?? 'default')
startOrchestratorScheduler()
