import type { Hono } from 'hono'
import { listContacts } from '../stores/contacts-store'
import { listConversations } from '../stores/conversations-store'
import { listAppointments } from '../stores/appointments-store'
import { listPosts } from '../stores/social-store'
import { listCampaigns } from '../stores/campaigns-store'
import { listPages } from '../stores/pages-store'

export interface Highlight {
  id: string
  kind: 'lead' | 'conversation' | 'appointment' | 'social' | 'campaign' | 'page'
  priority: 'attention' | 'info'
  emoji: string
  title: string
  detail: string
  link: string
  at: string | null
}

function buildHighlights(brand: string | null): Highlight[] {
  const out: Highlight[] = []
  const now = Date.now()
  const soon = now + 7 * 24 * 60 * 60 * 1000
  const dayAgo = now - 24 * 60 * 60 * 1000
  const bf = (b?: string | null) => !brand || !b || b === brand

  // Unread conversations needing a reply
  const unread = listConversations({}).filter((c) => c.unread && bf((c as { brand?: string }).brand))
  for (const c of unread.slice(0, 8)) {
    out.push({
      id: `conv-${c.id}`, kind: 'conversation', priority: 'attention', emoji: '💬',
      title: `Unread: ${c.contact_name ?? 'Web visitor'}`,
      detail: c.subject ?? 'New message awaiting reply',
      link: '/conversations', at: c.updated_at ?? null,
    })
  }

  // Upcoming appointments (next 7 days)
  for (const a of listAppointments({})) {
    if (!bf((a as { brand?: string }).brand)) continue
    const t = a.starts_at ? Date.parse(a.starts_at) : NaN
    if (Number.isNaN(t) || t < now || t > soon || a.status === 'cancelled') continue
    out.push({
      id: `appt-${a.id}`, kind: 'appointment', priority: 'info', emoji: '📅',
      title: `Upcoming: ${a.title}`,
      detail: a.contact_name ? `with ${a.contact_name}` : 'Scheduled',
      link: '/appointments', at: a.starts_at,
    })
  }

  // New leads in the last 24h
  for (const ct of listContacts({})) {
    if (!bf((ct as { brand?: string }).brand)) continue
    const created = ct.created_at ? Date.parse(ct.created_at) : NaN
    if (ct.stage !== 'lead' || Number.isNaN(created) || created < dayAgo) continue
    out.push({
      id: `lead-${ct.id}`, kind: 'lead', priority: 'attention', emoji: '✨',
      title: `New lead: ${ct.name ?? ct.email ?? 'Unknown'}`,
      detail: ct.source ? `via ${ct.source}` : 'Added to pipeline',
      link: '/contacts', at: ct.created_at ?? null,
    })
  }

  // Scheduled social posts going out soon
  for (const p of listPosts({})) {
    if (!bf((p as { brand?: string }).brand)) continue
    if (p.status !== 'scheduled' || !p.scheduled_at) continue
    const t = Date.parse(p.scheduled_at)
    if (Number.isNaN(t) || t > soon) continue
    out.push({
      id: `post-${p.id}`, kind: 'social', priority: 'info', emoji: '📣',
      title: 'Scheduled post going out',
      detail: (p.content ?? '').slice(0, 60) || 'Social post',
      link: '/social', at: p.scheduled_at,
    })
  }

  // Draft campaigns waiting to send
  for (const cp of listCampaigns({})) {
    if (!bf((cp as { brand?: string }).brand)) continue
    if (cp.status !== 'draft') continue
    out.push({
      id: `camp-${cp.id}`, kind: 'campaign', priority: 'info', emoji: '✉️',
      title: `Draft campaign: ${cp.name}`,
      detail: 'Ready to review & send',
      link: '/campaigns', at: cp.updated_at ?? null,
    })
  }

  // Recently published pages
  for (const pg of listPages({})) {
    if (!bf((pg as { brand?: string }).brand)) continue
    if (pg.status !== 'published') continue
    const t = pg.updated_at ? Date.parse(pg.updated_at) : NaN
    if (Number.isNaN(t) || t < dayAgo) continue
    out.push({
      id: `page-${pg.id}`, kind: 'page', priority: 'info', emoji: '🌐',
      title: `Page live: ${pg.title}`,
      detail: `/${pg.slug}`,
      link: '/pages', at: pg.updated_at ?? null,
    })
  }

  out.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'attention' ? -1 : 1
    return (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0)
  })
  return out
}

export function registerHighlights(app: Hono): void {
  app.get('/api/highlights', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand')
    const highlights = buildHighlights(brand)
    return c.json({
      highlights,
      attention: highlights.filter((h) => h.priority === 'attention').length,
    })
  })
}
