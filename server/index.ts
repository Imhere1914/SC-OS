import { Hono } from 'hono'
import { serve } from '@hono/node-server'
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

const app = new Hono()

const BRANDS: Record<string, { id: string; name: string; shortName: string; accentColor: string }> = {
  sc: { id: 'sc', name: 'SC Intelligence', shortName: 'SC', accentColor: '#2f6df6' },
  hfm: { id: 'hfm', name: 'HFM Intelligence', shortName: 'HFM', accentColor: '#7c6f9b' },
  default: { id: 'default', name: 'AI OS', shortName: 'OS', accentColor: '#2f6df6' },
}

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

const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: app.fetch, port })
console.log(`[ai-os] API listening on http://localhost:${port}`)
