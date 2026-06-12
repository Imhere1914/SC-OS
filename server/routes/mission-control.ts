import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { listInvoices } from '../stores/invoices-store'
import { listDeals } from '../stores/deals-store'
import { listAppointments } from '../stores/appointments-store'
import { listBills } from '../stores/bills-store'
import { listAllTasks } from '../stores/project-tasks-store'

// ── Types ────────────────────────────────────────────────────────────────────

interface OverdueInvoiceItem {
  id: string
  contact_name: string
  amount: number
  days_overdue: number
}

interface ColdDealItem {
  id: string
  title: string
  stage: string
  days_since_update: number
}

interface AppointmentItem {
  id: string
  title: string
  contact_name: string | null
  start_time: string
  status: string
}

interface MissionControlPayload {
  urgent: {
    overdue_invoices: { count: number; total_cents: number; items: OverdueInvoiceItem[] }
    bills_due_this_week: { count: number; total_cents: number }
    cold_deals: { count: number; items: ColdDealItem[] }
    unread_conversations: number
  }
  today: {
    appointments: AppointmentItem[]
    tasks_due: number
  }
  momentum: {
    new_contacts_this_week: number
    revenue_this_month_cents: number
    deals_won_this_month: number
    invoices_paid_this_month: number
  }
  pipeline: {
    total_open_deals: number
    total_pipeline_value_cents: number
    by_stage: { stage: string; count: number; value_cents: number }[]
  }
  brand: string
  generated_at: string
}

export function registerMissionControl(app: Hono): void {
  app.get('/api/mission-control', async (c) => {
    const brand = getBrandId(c)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    // ── Overdue invoices ─────────────────────────────────────────────────────
    let overdueInvoiceItems: OverdueInvoiceItem[] = []
    let overdueInvoicesTotalCents = 0
    try {
      const invoices = listInvoices(brand)
      const overdue = invoices.filter(
        (inv) => inv.status === 'sent' && inv.due_date != null && inv.due_date < todayStr,
      )
      overdueInvoicesTotalCents = overdue.reduce((sum, inv) => sum + Math.round(inv.total * 100), 0)
      overdueInvoiceItems = overdue.slice(0, 5).map((inv) => ({
        id: inv.id,
        contact_name: inv.contact_name,
        amount: inv.total,
        days_overdue: Math.floor(
          (now.getTime() - new Date(inv.due_date!).getTime()) / 86_400_000,
        ),
      }))
    } catch {
      // silently zero
    }

    // ── Bills due this week ──────────────────────────────────────────────────
    let billsDueCount = 0
    let billsDueTotalCents = 0
    try {
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().slice(0, 10)

      const bills = listBills(brand)
      const due = bills.filter(
        (b) =>
          (b.status === 'open' || b.status === 'overdue' || b.status === 'partial') &&
          b.due_date >= todayStr &&
          b.due_date <= weekEndStr,
      )
      billsDueCount = due.length
      billsDueTotalCents = due.reduce((sum, b) => sum + b.amount_due_cents, 0)
    } catch {
      // silently zero
    }

    // ── Cold deals ───────────────────────────────────────────────────────────
    let coldDealItems: ColdDealItem[] = []
    try {
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 14)
      const cutoffStr = cutoff.toISOString()

      const deals = listDeals(brand)
      const cold = deals.filter(
        (d) =>
          d.stage !== 'won' &&
          d.stage !== 'lost' &&
          d.updated_at < cutoffStr,
      )
      coldDealItems = cold.slice(0, 5).map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        days_since_update: Math.floor(
          (now.getTime() - new Date(d.updated_at).getTime()) / 86_400_000,
        ),
      }))
    } catch {
      // silently zero
    }

    // ── Today's appointments ─────────────────────────────────────────────────
    let todaysAppointments: AppointmentItem[] = []
    try {
      const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)
      const appts = listAppointments({ brand })
      todaysAppointments = appts
        .filter(
          (a) =>
            a.starts_at.slice(0, 10) === todayStr &&
            a.status !== 'cancelled',
        )
        .map((a) => ({
          id: a.id,
          title: a.title,
          contact_name: a.contact_name,
          start_time: a.starts_at,
          status: a.status,
        }))
      // tomorrowStr used only to avoid TS unused-var error
      void tomorrowStr
    } catch {
      // silently zero
    }

    // ── Tasks due today ──────────────────────────────────────────────────────
    let tasksDueToday = 0
    try {
      const tasks = listAllTasks()
      tasksDueToday = tasks.filter(
        (t) => t.brand === brand && t.due_date === todayStr && t.status !== 'done',
      ).length
    } catch {
      // silently zero
    }

    // ── Momentum: new contacts this week ────────────────────────────────────
    let newContactsThisWeek = 0
    try {
      // Dynamic import to avoid issues with file-path env var at module load
      const { listContacts } = await import('../stores/contacts-store')
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString()
      const contacts = listContacts({})
      newContactsThisWeek = contacts.filter(
        (c) => c.brand === brand && c.created_at >= weekAgoStr,
      ).length
    } catch {
      // silently zero
    }

    // ── Momentum: revenue this month (paid invoices) ─────────────────────────
    let revenueThisMonthCents = 0
    let invoicesPaidThisMonth = 0
    try {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const invoices = listInvoices(brand)
      const paid = invoices.filter(
        (inv) =>
          inv.status === 'paid' &&
          inv.paid_at != null &&
          inv.paid_at >= monthStart,
      )
      invoicesPaidThisMonth = paid.length
      revenueThisMonthCents = paid.reduce((sum, inv) => sum + Math.round(inv.total * 100), 0)
    } catch {
      // silently zero
    }

    // ── Pipeline ─────────────────────────────────────────────────────────────
    let totalOpenDeals = 0
    let totalPipelineValueCents = 0
    const byStage: { stage: string; count: number; value_cents: number }[] = []
    let dealsWonThisMonth = 0
    try {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const deals = listDeals(brand)
      const openStages = ['lead', 'qualified', 'proposal', 'negotiation'] as const
      const stageMap = new Map<string, { count: number; value_cents: number }>()
      for (const stage of openStages) {
        stageMap.set(stage, { count: 0, value_cents: 0 })
      }
      for (const deal of deals) {
        if (deal.stage === 'won' || deal.stage === 'lost') {
          if (deal.stage === 'won' && deal.closed_at != null && deal.closed_at >= monthStart) {
            dealsWonThisMonth++
          }
          continue
        }
        totalOpenDeals++
        totalPipelineValueCents += deal.value
        const entry = stageMap.get(deal.stage)
        if (entry) {
          entry.count++
          entry.value_cents += deal.value
        }
      }
      for (const [stage, data] of stageMap) {
        byStage.push({ stage, ...data })
      }
    } catch {
      // silently zero
    }

    const payload: MissionControlPayload = {
      urgent: {
        overdue_invoices: {
          count: overdueInvoiceItems.length,
          total_cents: overdueInvoicesTotalCents,
          items: overdueInvoiceItems,
        },
        bills_due_this_week: {
          count: billsDueCount,
          total_cents: billsDueTotalCents,
        },
        cold_deals: {
          count: coldDealItems.length,
          items: coldDealItems,
        },
        unread_conversations: 0, // surfaced via separate /api/stats
      },
      today: {
        appointments: todaysAppointments,
        tasks_due: tasksDueToday,
      },
      momentum: {
        new_contacts_this_week: newContactsThisWeek,
        revenue_this_month_cents: revenueThisMonthCents,
        deals_won_this_month: dealsWonThisMonth,
        invoices_paid_this_month: invoicesPaidThisMonth,
      },
      pipeline: {
        total_open_deals: totalOpenDeals,
        total_pipeline_value_cents: totalPipelineValueCents,
        by_stage: byStage,
      },
      brand,
      generated_at: now.toISOString(),
    }

    return c.json(payload)
  })
}
