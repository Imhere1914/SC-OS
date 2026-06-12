import type { Hono } from 'hono'
import { listContacts } from '../stores/contacts-store'
import { listConversations } from '../stores/conversations-store'
import { listAppointments } from '../stores/appointments-store'
import { listCampaigns } from '../stores/campaigns-store'
import { listPosts } from '../stores/social-store'
import { listProjects } from '../stores/projects-store'
import { listAllTasks } from '../stores/project-tasks-store'
import { listForms } from '../stores/forms-store'
import { listInvoices } from '../stores/invoices-store'
import { readRuns } from '../stores/automations-store'

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
    const forms = listForms(brand ?? undefined)
    const invoices = listInvoices(brand ?? undefined)

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

    // Tasks due today
    const todayStr = new Date().toISOString().slice(0, 10)
    const allTasks = listAllTasks()
    const tasksDueToday = allTasks.filter(t => t.due_date === todayStr && t.status !== 'done').length
    const tasksOverdue = allTasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'done').length

    // Automations run this week
    const runs = readRuns()
    const automationsThisWeek = runs.filter(r => {
      const t = r.ran_at ? Date.parse(r.ran_at) : NaN
      return !Number.isNaN(t) && t > now - week
    }).length

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
      tasks: {
        dueToday: tasksDueToday,
        overdue: tasksOverdue,
      },
      automations: {
        runsThisWeek: automationsThisWeek,
      },
      forms: {
        total: forms.length,
        active: forms.filter((f) => f.status === 'active').length,
      },
      payments: {
        paid: Math.round(invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0) * 100) / 100,
        outstanding: Math.round(invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0) * 100) / 100,
        draft: invoices.filter((i) => i.status === 'draft').length,
        total: invoices.length,
      },
    })
  })

  // ── Recent Activity feed ──────────────────────────────────────────────────
  app.get('/api/activity', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? process.env.BRAND ?? null
    const bf = (b?: string | null) => !brand || brand === 'default' ? true : b === brand

    type ActivityItem = {
      id: string; type: string; title: string; sub: string
      link: string; at: string
    }
    const items: ActivityItem[] = []

    // Recent contacts
    listContacts({}).filter(c => bf((c as { brand?: string }).brand)).forEach(c => {
      if (c.created_at) items.push({
        id: `contact-${c.id}`, type: 'contact',
        title: c.name, sub: `New contact · ${c.stage}`,
        link: `/contacts/${c.id}`, at: c.created_at,
      })
    })

    // Recent conversations
    listConversations({}).filter(c => bf((c as { brand?: string }).brand)).forEach(c => {
      const at = (c as { created_at?: string }).created_at ?? ''
      if (at) items.push({
        id: `conv-${c.id}`, type: 'conversation',
        title: c.contact_name ?? 'New conversation',
        sub: `${c.channel} · ${c.status}`,
        link: '/conversations', at,
      })
    })

    // Recent appointments
    listAppointments({}).filter(a => bf((a as { brand?: string }).brand)).forEach(a => {
      const at = (a as { created_at?: string }).created_at ?? a.starts_at ?? ''
      if (at) items.push({
        id: `appt-${a.id}`, type: 'appointment',
        title: a.contact_name ?? 'Appointment',
        sub: a.starts_at ? `Booked for ${new Date(a.starts_at).toLocaleDateString()}` : 'Scheduled',
        link: '/appointments', at,
      })
    })

    // Recent automation runs
    readRuns().forEach(r => {
      items.push({
        id: `run-${r.id}`, type: 'automation',
        title: r.automation_name,
        sub: `${r.status} · ${r.actions_run} action${r.actions_run !== 1 ? 's' : ''}`,
        link: '/automations', at: r.ran_at,
      })
    })

    // Sort newest-first, cap at 20
    items.sort((a, b) => b.at.localeCompare(a.at))
    return c.json({ items: items.slice(0, 20) })
  })
}
