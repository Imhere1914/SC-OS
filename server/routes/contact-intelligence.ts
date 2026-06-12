import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { getContact } from '../stores/contacts-store'
import { listDeals } from '../stores/deals-store'
import { listInvoices } from '../stores/invoices-store'
import { listAppointments } from '../stores/appointments-store'
import { listProposals } from '../stores/proposals-store'
import { listProjects } from '../stores/projects-store'
import { getLoyaltyAccount } from '../stores/loyalty-store'
import { listDocuments } from '../stores/documents-store'
import { listCommissions } from '../stores/commissions-store'

type TimelineItem = {
  id: string
  type: string
  title: string
  date: string
  meta?: string
  amount_cents?: number
  status?: string
}

export function registerContactIntelligence(app: Hono) {
  app.get('/api/contacts/:id/intelligence', async (c) => {
    const brand = getBrandId(c)
    const contactId = c.req.param('id')

    const [
      contactResult,
      dealsResult,
      invoicesResult,
      appointmentsResult,
      proposalsResult,
      projectsResult,
      loyaltyResult,
      documentsResult,
      commissionsResult,
    ] = await Promise.allSettled([
      Promise.resolve(getContact(contactId)),
      Promise.resolve(listDeals(brand).filter(d => d.contact_id === contactId)),
      Promise.resolve(listInvoices(brand).filter(i => i.contact_id === contactId)),
      Promise.resolve(listAppointments({ brand, contact_id: contactId })),
      Promise.resolve(listProposals(brand).filter(p => p.contact_id === contactId)),
      Promise.resolve(listProjects({ brand, contact_id: contactId })),
      Promise.resolve(getLoyaltyAccount(brand, contactId)),
      Promise.resolve(listDocuments(brand, { contact_id: contactId })),
      Promise.resolve(listCommissions(brand)),
    ])

    // Build timeline
    const timeline: TimelineItem[] = []

    if (dealsResult.status === 'fulfilled') {
      for (const d of dealsResult.value) {
        timeline.push({
          id: `deal-${d.id}`,
          type: 'deal',
          title: d.title,
          date: d.created_at,
          amount_cents: d.value,
          status: d.stage,
          meta: `Deal · ${d.stage}`,
        })
        if (d.closed_at) {
          timeline.push({
            id: `deal-closed-${d.id}`,
            type: d.stage === 'won' ? 'deal_won' : 'deal_lost',
            title: `${d.title} ${d.stage === 'won' ? 'won' : 'lost'}`,
            date: d.closed_at,
            amount_cents: d.value,
            status: d.stage,
            meta: `Deal ${d.stage}`,
          })
        }
      }
    }

    if (invoicesResult.status === 'fulfilled') {
      for (const inv of invoicesResult.value) {
        timeline.push({
          id: `invoice-${inv.id}`,
          type: 'invoice_created',
          title: `Invoice ${inv.invoice_number}`,
          date: inv.created_at,
          amount_cents: Math.round(inv.total * 100),
          status: inv.status,
          meta: `Invoice · ${inv.status}`,
        })
        if (inv.paid_at) {
          timeline.push({
            id: `invoice-paid-${inv.id}`,
            type: 'invoice_paid',
            title: `Invoice ${inv.invoice_number} paid`,
            date: inv.paid_at,
            amount_cents: Math.round(inv.total * 100),
            status: 'paid',
            meta: 'Invoice paid',
          })
        }
      }
    }

    if (appointmentsResult.status === 'fulfilled') {
      for (const a of appointmentsResult.value) {
        timeline.push({
          id: `appt-${a.id}`,
          type: a.status === 'completed' ? 'appointment_completed' : 'appointment_scheduled',
          title: a.title,
          date: a.starts_at,
          status: a.status,
          meta: `Appointment · ${a.status}`,
        })
      }
    }

    if (proposalsResult.status === 'fulfilled') {
      for (const p of proposalsResult.value) {
        timeline.push({
          id: `proposal-${p.id}`,
          type: 'proposal_sent',
          title: p.title,
          date: p.sent_at ?? p.created_at,
          status: p.status,
          meta: `Proposal · ${p.status}`,
        })
        if (p.signed_at) {
          timeline.push({
            id: `proposal-signed-${p.id}`,
            type: 'proposal_signed',
            title: `${p.title} signed`,
            date: p.signed_at,
            status: 'accepted',
            meta: 'Proposal signed',
          })
        }
      }
    }

    if (projectsResult.status === 'fulfilled') {
      for (const proj of projectsResult.value) {
        timeline.push({
          id: `project-${proj.id}`,
          type: 'project_created',
          title: proj.name,
          date: proj.created_at,
          status: proj.status,
          meta: `Project · ${proj.status}`,
        })
      }
    }

    // Sort by date descending
    timeline.sort((a, b) => b.date.localeCompare(a.date))

    // Stats
    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : []
    const invoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []
    const appointments = appointmentsResult.status === 'fulfilled' ? appointmentsResult.value : []
    const proposals = proposalsResult.status === 'fulfilled' ? proposalsResult.value : []
    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : []

    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + Math.round(i.total * 100), 0)

    const now = new Date().toISOString()

    return c.json({
      contact: contactResult.status === 'fulfilled' ? contactResult.value : null,
      stats: {
        total_deals: deals.length,
        open_deals: deals.filter(d => !['won', 'lost'].includes(d.stage)).length,
        total_invoices: invoices.length,
        total_revenue_cents: totalRevenue,
        upcoming_appointments: appointments.filter(a => a.starts_at >= now).length,
        total_projects: projects.length,
        open_proposals: proposals.filter(p => p.status === 'sent').length,
      },
      deals,
      invoices,
      appointments,
      proposals,
      projects,
      loyalty: loyaltyResult.status === 'fulfilled' ? loyaltyResult.value : null,
      documents: documentsResult.status === 'fulfilled' ? documentsResult.value : [],
      commissions: commissionsResult.status === 'fulfilled'
        ? commissionsResult.value.filter(cm =>
            deals.some(d => d.id === cm.reference_id) ||
            invoices.some(i => i.id === cm.reference_id)
          )
        : [],
      timeline,
    })
  })
}
