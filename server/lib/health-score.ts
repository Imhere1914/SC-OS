import { listContacts } from '../stores/contacts-store'
import { listDeals } from '../stores/deals-store'
import { listInvoices } from '../stores/invoices-store'

export interface ContactHealth {
  contact_id: string
  contact_name: string
  brand: string
  score: number                    // 0-100
  tier: 'healthy' | 'neutral' | 'at_risk' | 'critical'
  factors: {
    recency: number
    invoice_payment: number
    deal_activity: number
    engagement: number
    lead_score: number
  }
  last_activity_days?: number
  open_deals: number
  unpaid_invoices: number
  computed_at: string
}

function scoreTier(score: number): ContactHealth['tier'] {
  if (score >= 75) return 'healthy'
  if (score >= 50) return 'neutral'
  if (score >= 25) return 'at_risk'
  return 'critical'
}

export async function computeHealthScores(brand: string): Promise<ContactHealth[]> {
  const contacts = listContacts()
  const deals = listDeals(brand)
  const invoices = listInvoices(brand)
  const now = Date.now()
  const nowIso = new Date().toISOString()

  return contacts.map((contact) => {
    // ── Recency (30 pts) ─────────────────────────────────────────────────────
    // Use updated_at or last_contacted_at, whichever is most recent
    const updatedAt = contact.updated_at ? Date.parse(contact.updated_at) : 0
    const lastContactedAt = contact.last_contacted_at ? Date.parse(contact.last_contacted_at) : 0
    const lastTs = Math.max(updatedAt, lastContactedAt)
    const daysSince = lastTs > 0 ? (now - lastTs) / (1000 * 60 * 60 * 24) : 999
    const recencyScore = daysSince <= 0
      ? 30
      : daysSince >= 60
        ? 0
        : Math.round(30 * (1 - daysSince / 60))

    // ── Invoice payment (25 pts) ─────────────────────────────────────────────
    const contactInvoices = invoices.filter((inv) => inv.contact_id === contact.id)
    const totalInvoices = contactInvoices.length
    const paidInvoices = contactInvoices.filter((inv) => inv.status === 'paid').length
    const unpaidInvoices = contactInvoices.filter((inv) => inv.status === 'sent').length
    const invoiceScore = totalInvoices === 0
      ? 25  // no invoices → neutral (no negative signal)
      : Math.round((paidInvoices / totalInvoices) * 25)

    // ── Deal activity (20 pts) ───────────────────────────────────────────────
    const contactDeals = deals.filter((d) => d.contact_id === contact.id)
    const openDealStages = new Set(['lead', 'qualified', 'proposal', 'negotiation'])
    const openDeals = contactDeals.filter((d) => openDealStages.has(d.stage))
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000
    const recentDeals = contactDeals.filter((d) => Date.parse(d.updated_at) >= ninetyDaysAgo)
    const dealScore = openDeals.length > 0
      ? 20
      : recentDeals.length > 0
        ? 10
        : 0

    // ── Engagement (15 pts) ──────────────────────────────────────────────────
    const hasEmail = contact.email ? 5 : 0
    const hasPhone = contact.phone ? 5 : 0
    const hasCompany = contact.company ? 5 : 0
    const engagementScore = hasEmail + hasPhone + hasCompany

    // ── Lead score (10 pts) ──────────────────────────────────────────────────
    const rawLeadScore = contact.custom_fields?.['lead_score']
      ? parseFloat(contact.custom_fields['lead_score'])
      : null
    const leadScorePoints =
      rawLeadScore != null && !isNaN(rawLeadScore)
        ? Math.round((Math.min(100, Math.max(0, rawLeadScore)) / 100) * 10)
        : 0

    // ── Total ────────────────────────────────────────────────────────────────
    const score = Math.min(100, recencyScore + invoiceScore + dealScore + engagementScore + leadScorePoints)

    return {
      contact_id: contact.id,
      contact_name: contact.name,
      brand: contact.brand,
      score,
      tier: scoreTier(score),
      factors: {
        recency: recencyScore,
        invoice_payment: invoiceScore,
        deal_activity: dealScore,
        engagement: engagementScore,
        lead_score: leadScorePoints,
      },
      last_activity_days: lastTs > 0 ? Math.round(daysSince) : undefined,
      open_deals: openDeals.length,
      unpaid_invoices: unpaidInvoices,
      computed_at: nowIso,
    }
  })
}
