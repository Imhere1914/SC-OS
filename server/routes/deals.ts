import type { Hono } from 'hono'
import { listDeals, getDeal, createDeal, updateDeal, deleteDeal, DEAL_STAGES } from '../stores/deals-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { paginate, paginationParams } from '../lib/paginate'
import { eventBus } from '../lib/event-bus'

const BRAND = process.env.BRAND ?? 'default'

export function registerDeals(app: Hono) {
  app.get('/api/deals', (c) => {
    const brand = c.req.query('brand')
    const stage = c.req.query('stage')
    let allDeals = listDeals(brand)
    if (stage) allDeals = allDeals.filter(d => d.stage === stage)
    const { limit, offset } = paginationParams({ limit: c.req.query('limit'), offset: c.req.query('offset') })
    const paginatedResult = paginate(allDeals, limit, offset)
    return c.json({ deals: paginatedResult.data, total: paginatedResult.total, has_more: paginatedResult.has_more })
  })

  app.get('/api/deals/analytics', (c) => {
    const brand = c.req.query('brand')
    const deals = listDeals(brand)

    const STAGE_LABELS: Record<string, string> = {
      lead: 'Lead',
      qualified: 'Qualified',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      won: 'Won',
      lost: 'Lost',
    }

    // Funnel — count + value per stage
    const funnel = DEAL_STAGES.map(stage => ({
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count: deals.filter(d => d.stage === stage).length,
      value_cents: deals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0),
    }))

    // Win/loss
    const won = deals.filter(d => d.stage === 'won')
    const lost = deals.filter(d => d.stage === 'lost')
    const won_count = won.length
    const lost_count = lost.length
    const decided = won_count + lost_count
    const win_rate = decided > 0 ? Math.round((won_count / decided) * 100) : 0

    // Velocity — avg days from created_at to closed_at for won deals
    const wonWithClose = won.filter(d => d.closed_at)
    const avg_days_to_close = wonWithClose.length > 0
      ? Math.round(
          wonWithClose.reduce((sum, d) => {
            const ms = new Date(d.closed_at!).getTime() - new Date(d.created_at).getTime()
            return sum + ms / (1000 * 60 * 60 * 24)
          }, 0) / wonWithClose.length,
        )
      : 0

    // Pipeline values
    const openDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost')
    const total_pipeline_value = openDeals.reduce((s, d) => s + d.value, 0)
    const weighted_pipeline = openDeals.reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0)
    const total_won_value = won.reduce((s, d) => s + d.value, 0)

    // Monthly trend — last 6 months
    const now = new Date()
    const monthly_created: Array<{ month: string; count: number; value_cents: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      const monthDeals = deals.filter(deal => {
        const cd = new Date(deal.created_at)
        return cd.getFullYear() === year && cd.getMonth() === month
      })
      monthly_created.push({
        month: label,
        count: monthDeals.length,
        value_cents: monthDeals.reduce((s, d) => s + d.value, 0),
      })
    }

    // Top 5 open deals by value
    const top_deals = openDeals
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(d => ({
        id: d.id,
        title: d.title,
        value: d.value,
        stage: d.stage,
        contact_name: d.contact_name,
        probability: d.probability,
      }))

    // Forecast — next 30/60/90 days weighted by probability
    const todayMs = Date.now()
    const d30 = todayMs + 30 * 86400_000
    const d60 = todayMs + 60 * 86400_000
    const d90 = todayMs + 90 * 86400_000

    let forecast_30 = 0
    let forecast_60 = 0
    let forecast_90 = 0
    for (const deal of openDeals) {
      if (!deal.close_date) continue
      const closeMs = new Date(deal.close_date).getTime()
      const weighted = deal.value * ((deal.probability ?? 50) / 100)
      if (closeMs <= d30) forecast_30 += weighted
      if (closeMs <= d60) forecast_60 += weighted
      if (closeMs <= d90) forecast_90 += weighted
    }

    return c.json({
      funnel,
      won_count,
      lost_count,
      win_rate,
      avg_days_to_close,
      total_pipeline_value: Math.round(total_pipeline_value),
      weighted_pipeline: Math.round(weighted_pipeline),
      total_won_value: Math.round(total_won_value),
      monthly_created,
      top_deals,
      forecast_30: Math.round(forecast_30),
      forecast_60: Math.round(forecast_60),
      forecast_90: Math.round(forecast_90),
    })
  })

  app.get('/api/deals/:id', (c) => {
    const deal = getDeal(c.req.param('id'))
    if (!deal) return c.json({ error: 'not found' }, 404)
    return c.json(deal)
  })

  app.post('/api/deals', async (c) => {
    const body = await c.req.json()
    if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)
    const deal = createDeal({ ...body, brand: body.brand ?? BRAND })
    if (deal.contact_id) {
      appendActivity({
        contact_id: deal.contact_id,
        type: 'deal_created',
        description: `Deal created: "${deal.title}" ($${(deal.value / 100).toFixed(2)})`,
      })
    }
    appendNotification({ brand: BRAND, message: `New deal: ${deal.title}`, context_summary: `Stage: ${deal.stage}` })
    void eventBus.emit({
      type: 'deal.created',
      brand: deal.brand ?? BRAND,
      entity_id: deal.id,
      entity_type: 'deal',
      data: { title: deal.title, value: deal.value, contact_name: deal.contact_name ?? '', actor: 'user' },
      occurred_at: new Date().toISOString(),
    })
    return c.json(deal, 201)
  })

  app.patch('/api/deals/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const prev = getDeal(id)
    const deal = updateDeal(id, body, brand)
    if (!deal) return c.json({ error: 'not found' }, 404)
    if (prev && prev.stage !== deal.stage) {
      if (deal.contact_id) {
        appendActivity({
          contact_id: deal.contact_id,
          type: 'deal_stage_changed',
          description: `Deal "${deal.title}" moved to ${deal.stage}`,
        })
      }
      void eventBus.emit({
        type: 'deal.stage_changed',
        brand: deal.brand ?? BRAND,
        entity_id: deal.id,
        entity_type: 'deal',
        data: { title: deal.title, value: deal.value, contact_name: deal.contact_name ?? '', previous_stage: prev.stage, new_stage: deal.stage, actor: 'user' },
        occurred_at: new Date().toISOString(),
      })
      if (deal.stage === 'won' && prev.stage !== 'won') {
        void eventBus.emit({
          type: 'deal.won',
          brand: deal.brand ?? BRAND,
          entity_id: deal.id,
          entity_type: 'deal',
          data: { title: deal.title, value: deal.value, contact_name: deal.contact_name ?? '', actor: 'user' },
          occurred_at: new Date().toISOString(),
        })
      }
    }
    return c.json(deal)
  })

  app.delete('/api/deals/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteDeal(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
