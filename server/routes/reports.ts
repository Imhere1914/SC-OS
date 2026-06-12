/**
 * Reports API — pre-computed analytics for the Reports screen.
 * GET /api/reports?brand=xxx
 */
import type { Hono } from 'hono'
import { listContacts } from '../stores/contacts-store'
import { listAppointments } from '../stores/appointments-store'
import { listConversations } from '../stores/conversations-store'
import { listInvoices } from '../stores/invoices-store'
import { listCampaigns } from '../stores/campaigns-store'
import { listPosts } from '../stores/social-store'
import { readRuns } from '../stores/automations-store'

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastNMonths(n: number, anchorDate = new Date()): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function labelMonth(key: string): string {
  const [, m] = key.split('-')
  return MONTH_SHORT[parseInt(m) - 1]
}

export function registerReports(app: Hono): void {
  app.get('/api/reports', (c) => {
    const qs = new URL(c.req.url).searchParams
    const brand = qs.get('brand')
    const bf = (b?: string | null) => !brand || !b || b === brand || b === 'default'

    // Date range: `since` is an ISO date string (inclusive), `until` defaults to now
    const sinceParam = qs.get('since')
    const untilParam = qs.get('until')
    const sinceDate = sinceParam ? new Date(sinceParam) : null
    const untilDate = untilParam ? new Date(untilParam) : new Date()

    const inRange = (iso: string | null | undefined) => {
      if (!iso) return true
      const d = new Date(iso)
      if (sinceDate && d < sinceDate) return false
      if (d > untilDate) return false
      return true
    }

    const allContacts = listContacts({}).filter(ct => bf(ct.brand))
    const allAppts    = listAppointments({}).filter(a => bf((a as { brand?: string }).brand))
    const allConvs    = listConversations({}).filter(cv => bf((cv as { brand?: string }).brand))
    const allInvoices = listInvoices(brand ?? undefined)
    const allCampaigns = listCampaigns({}).filter(cp => bf((cp as { brand?: string }).brand))
    const allPosts    = listPosts({}).filter(p => bf((p as { brand?: string }).brand))
    const allRuns     = readRuns()

    // Apply date range to time-series data; pipeline/totals stay all-time for pipeline view
    const contacts  = allContacts
    const appts     = allAppts.filter(a => inRange(a.starts_at))
    const convs     = allConvs.filter(cv => inRange((cv as { created_at?: string }).created_at))
    const invoices  = allInvoices.filter(i => inRange(i.paid_at ?? i.created_at))
    const campaigns = allCampaigns.filter(cp => inRange((cp as { created_at?: string }).created_at))
    const posts     = allPosts.filter(p => inRange((p as { created_at?: string }).created_at))
    const runs      = allRuns.filter(r => inRange(r.ran_at))

    // Determine how many months to show based on range
    const monthCount = sinceDate
      ? Math.max(1, Math.min(24, Math.ceil((untilDate.getTime() - sinceDate.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1))
      : 6
    const months = lastNMonths(monthCount, untilDate)

    // ── Pipeline funnel (always all-time — pipeline is a point-in-time snapshot) ─
    const pipeline = {
      lead:      allContacts.filter(c => c.stage === 'lead').length,
      contacted: allContacts.filter(c => c.stage === 'contacted').length,
      qualified: allContacts.filter(c => c.stage === 'qualified').length,
      customer:  allContacts.filter(c => c.stage === 'customer').length,
      lost:      allContacts.filter(c => c.stage === 'lost').length,
    }
    const pipelineMax = Math.max(...Object.values(pipeline), 1)
    const pipelineFunnel = Object.entries(pipeline).map(([stage, count]) => ({
      stage, count, pct: Math.round((count / pipelineMax) * 100),
    }))

    // ── New contacts per month ────────────────────────────────────────────────
    const contactsByMonth = months.map(mk => ({
      month: labelMonth(mk),
      count: contacts.filter(c => c.created_at && monthKey(c.created_at) === mk).length,
    }))

    // ── Revenue by month ──────────────────────────────────────────────────────
    const paidWithDate = invoices.filter(i => i.status === 'paid' && i.paid_at)
    const revenueByMonth = months.map(mk => ({
      month: labelMonth(mk),
      amount: paidWithDate
        .filter(i => i.paid_at && monthKey(i.paid_at) === mk)
        .reduce((s, i) => s + i.total, 0),
    }))
    const revenueMax = Math.max(...revenueByMonth.map(r => r.amount), 1)

    // ── Appointments by month ──────────────────────────────────────────────────
    const apptsByMonth = months.map(mk => ({
      month: labelMonth(mk),
      count: appts.filter(a => a.starts_at && monthKey(a.starts_at) === mk && a.status !== 'cancelled').length,
    }))

    // ── Campaign summary ──────────────────────────────────────────────────────
    const sentCampaigns = allCampaigns.filter(c => c.status === 'sent').slice(0, 5)
    const campaignStats = sentCampaigns.map(cp => ({
      name: cp.name,
      recipients: cp.stats?.recipients ?? 0,
      sent: cp.stats?.sent ?? 0,
      opens: 0,
      rate: cp.stats?.recipients ? Math.round(((cp.stats?.sent ?? 0) / cp.stats.recipients) * 100) : 0,
    }))

    // ── Totals (period-scoped where meaningful, all-time for pipeline snapshot) ─
    const paidInPeriod = invoices.filter(i => i.status === 'paid')
    const totals = {
      contacts: allContacts.length,
      customers: pipeline.customer,
      revenue_paid: Math.round(paidInPeriod.reduce((s, i) => s + i.total, 0) * 100) / 100,
      revenue_outstanding: Math.round(allInvoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.total, 0) * 100) / 100,
      appointments_completed: appts.filter(a => a.status === 'completed').length,
      campaigns_sent: campaigns.filter(c => c.status === 'sent').length,
      posts_published: posts.filter(p => p.status === 'published').length,
      conversion_rate: allContacts.length > 0 ? Math.round((pipeline.customer / allContacts.length) * 100) : 0,
    }

    // ── Conversations by channel ──────────────────────────────────────────────
    const channelCounts: Record<string, number> = {}
    for (const cv of convs) {
      channelCounts[cv.channel] = (channelCounts[cv.channel] ?? 0) + 1
    }
    const convsByChannel = Object.entries(channelCounts)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)

    // ── Conversations by month ────────────────────────────────────────────────
    const convsByMonth = months.map(mk => ({
      month: labelMonth(mk),
      count: convs.filter(cv => {
        const at = (cv as { created_at?: string }).created_at ?? ''
        return at && monthKey(at) === mk
      }).length,
    }))

    // ── Automation run stats ──────────────────────────────────────────────────
    const nowMs = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const runsThisWeek = allRuns.filter(r => Date.parse(r.ran_at) > nowMs - week).length
    const runSuccessRate = runs.length > 0
      ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100)
      : 100
    const automationStats = { total: allRuns.length, thisWeek: runsThisWeek, successRate: runSuccessRate }

    return c.json({
      totals,
      pipelineFunnel,
      contactsByMonth,
      revenueByMonth,
      revenueMax,
      apptsByMonth,
      campaignStats,
      convsByChannel,
      convsByMonth,
      automationStats,
    })
  })
}
