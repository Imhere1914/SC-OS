import type { Hono } from 'hono'
import { listContacts } from '../stores/contacts-store'
import { listConversations } from '../stores/conversations-store'
import { listAppointments } from '../stores/appointments-store'
import { listCampaigns } from '../stores/campaigns-store'
import { listPosts } from '../stores/social-store'
import { listProjects } from '../stores/projects-store'

export function registerStats(app: Hono): void {
  app.get('/api/stats', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? process.env.BRAND ?? null
    const bf = (b?: string | null) => !brand || brand === 'default' ? true : b === brand

    const contacts = listContacts({})
    const convs = listConversations({})
    const appts = listAppointments({})
    const campaigns = listCampaigns({})
    const posts = listPosts({})
    const projects = listProjects({})

    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const month = 30 * 24 * 60 * 60 * 1000

    // Pipeline funnel
    const pipeline = {
      lead: contacts.filter(c => c.stage === 'lead' && bf((c as { brand?: string }).brand)).length,
      contacted: contacts.filter(c => c.stage === 'contacted' && bf((c as { brand?: string }).brand)).length,
      qualified: contacts.filter(c => c.stage === 'qualified' && bf((c as { brand?: string }).brand)).length,
      customer: contacts.filter(c => c.stage === 'customer' && bf((c as { brand?: string }).brand)).length,
      lost: contacts.filter(c => c.stage === 'lost' && bf((c as { brand?: string }).brand)).length,
    }

    // New leads this week
    const newLeadsThisWeek = contacts.filter(c => {
      if (!bf((c as { brand?: string }).brand)) return false
      const t = c.created_at ? Date.parse(c.created_at) : NaN
      return !Number.isNaN(t) && t > now - week
    }).length

    // Conversations
    const unreadConvs = convs.filter(c => c.unread && bf((c as { brand?: string }).brand)).length
    const openConvs = convs.filter(c => c.status === 'open' && bf((c as { brand?: string }).brand)).length

    // Appointments this week
    const apptsThisWeek = appts.filter(a => {
      if (!bf((a as { brand?: string }).brand)) return false
      const t = a.starts_at ? Date.parse(a.starts_at) : NaN
      return !Number.isNaN(t) && t > now && t <= now + week && a.status !== 'cancelled'
    }).length

    // Campaigns
    const campaignsSent = campaigns.filter(cp => cp.status === 'sent' && bf((cp as { brand?: string }).brand))
    const totalRecipients = campaignsSent.reduce((s, cp) => s + (cp.stats?.recipients ?? 0), 0)
    const totalSent = campaignsSent.reduce((s, cp) => s + (cp.stats?.sent ?? 0), 0)

    // Social
    const scheduledPosts = posts.filter(p => p.status === 'scheduled' && bf((p as { brand?: string }).brand)).length
    const publishedPosts = posts.filter(p => p.status === 'published' && bf((p as { brand?: string }).brand)).length
    const publishedThisMonth = posts.filter(p => {
      if (!bf((p as { brand?: string }).brand) || p.status !== 'published') return false
      const t = p.updated_at ? Date.parse(p.updated_at) : NaN
      return !Number.isNaN(t) && t > now - month
    }).length

    // Projects
    const activeProjects = projects.filter(p => p.status === 'active' && bf((p as { brand?: string }).brand)).length

    return c.json({
      pipeline,
      contacts: {
        total: contacts.filter(c => bf((c as { brand?: string }).brand)).length,
        newThisWeek: newLeadsThisWeek,
      },
      conversations: {
        open: openConvs,
        unread: unreadConvs,
      },
      appointments: {
        thisWeek: apptsThisWeek,
      },
      campaigns: {
        sent: campaignsSent.length,
        totalRecipients,
        totalSent,
        deliveryRate: totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : null,
      },
      social: {
        scheduled: scheduledPosts,
        published: publishedPosts,
        publishedThisMonth,
      },
      projects: {
        active: activeProjects,
      },
    })
  })
}
