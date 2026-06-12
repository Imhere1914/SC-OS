import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { buildBusinessContext } from '../lib/business-context'
import { listInvoices, type InvoiceRecord } from '../stores/invoices-store'
import { listDeals, type DealRecord } from '../stores/deals-store'
import { listAppointments, type AppointmentRecord } from '../stores/appointments-store'

export function registerBriefing(app: Hono) {
  // GET /api/briefing — returns a cached or fresh AI-generated daily briefing
  app.get('/api/briefing', async (c) => {
    const brand = getBrandId(c)
    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.MODEL ?? 'minimax/minimax-m3'

    const context = buildBusinessContext(brand)

    if (!apiKey) {
      // Fallback: structured data without AI
      return c.json({
        generated: false,
        briefing: null,
        context,
        brand,
      })
    }

    // Build a focused prompt for a morning briefing
    const brandName = brand === 'hfm' ? 'Holistic Functional Care' : brand === 'sc' ? 'Simple Connect' : 'your business'
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const prompt = `You are the ${brandName} AI Operating System. Generate a concise morning briefing for today (${today}).

${context}

Write a brief, practical morning briefing in 3-4 short paragraphs:
1. Good morning greeting + today's date + one sentence on business health
2. What needs immediate attention (overdue items, urgent follow-ups)
3. Today's key opportunities (upcoming appointments, hot deals, pending proposals)
4. One brief recommendation or insight

Be specific, use actual numbers from the data. Keep each paragraph to 2-3 sentences max. No bullet points — flowing prose. Conversational but professional. For HFM, focus on patient care and practice health.`

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ai-os.app',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
          temperature: 0.7,
        }),
      })
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const briefing = data.choices[0]?.message?.content ?? null

      return c.json({ generated: true, briefing, context, brand })
    } catch {
      return c.json({ generated: false, briefing: null, context, brand })
    }
  })

  // GET /api/alerts — proactive alerts based on business state
  app.get('/api/alerts', (c) => {
    const brand = getBrandId(c)

    const alerts: {
      id: string
      severity: 'critical' | 'warning' | 'info'
      category: string
      title: string
      body: string
      action_label?: string
      action_url?: string
    }[] = []

    // Overdue invoices
    try {
      const invoices = listInvoices(brand)
      const now = new Date()
      const overdue = invoices.filter((i: InvoiceRecord) =>
        i.status === 'sent' && i.due_date != null && new Date(i.due_date) < now
      )
      if (overdue.length > 0) {
        const total = overdue.reduce((s: number, i: InvoiceRecord) => s + (i.total ?? 0), 0)
        alerts.push({
          id: 'overdue-invoices',
          severity: overdue.length >= 3 ? 'critical' : 'warning',
          category: 'Finance',
          title: `${overdue.length} overdue invoice${overdue.length !== 1 ? 's' : ''}`,
          body: `$${total.toFixed(0)} in unpaid invoices past due date. Oldest: ${overdue[0]?.due_date}`,
          action_label: 'Review Invoices',
          action_url: '/payments',
        })
      }
    } catch { /* skip */ }

    // Cold deals
    try {
      const deals = listDeals(brand)
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const cold = deals.filter((d: DealRecord) =>
        !['won', 'lost'].includes(d.stage) && new Date(d.updated_at) < cutoff
      )
      if (cold.length > 0) {
        alerts.push({
          id: 'cold-deals',
          severity: 'warning',
          category: 'Sales',
          title: `${cold.length} deal${cold.length !== 1 ? 's' : ''} going cold`,
          body: `No activity in 14+ days on ${cold.slice(0, 2).map((d: DealRecord) => d.title).join(', ')}${cold.length > 2 ? ` and ${cold.length - 2} more` : ''}`,
          action_label: 'View Pipeline',
          action_url: '/deals',
        })
      }
    } catch { /* skip */ }

    // Today's appointments
    try {
      const appts = listAppointments({ brand })
      const today = new Date().toISOString().slice(0, 10)
      const todayAppts = appts.filter((a: AppointmentRecord) =>
        a.starts_at.startsWith(today) && a.status !== 'cancelled'
      )
      if (todayAppts.length > 0) {
        alerts.push({
          id: 'today-appointments',
          severity: 'info',
          category: 'Schedule',
          title: `${todayAppts.length} appointment${todayAppts.length !== 1 ? 's' : ''} today`,
          body: todayAppts.slice(0, 2).map((a: AppointmentRecord) => {
            const t = new Date(a.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            return `${t} — ${a.title}`
          }).join(' | '),
          action_label: 'View Schedule',
          action_url: '/appointments',
        })
      }
    } catch { /* skip */ }

    return c.json({ alerts, brand, count: alerts.length })
  })
}
