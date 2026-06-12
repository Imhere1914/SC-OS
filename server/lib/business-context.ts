/**
 * Builds a concise live-data snapshot for injection into the AI system prompt.
 * Fails silently — never throws, never breaks the chat.
 */
import { listContacts } from '../stores/contacts-store'
import { listDeals } from '../stores/deals-store'
import { listInvoices } from '../stores/invoices-store'
import { listAppointments } from '../stores/appointments-store'
import { listProjects } from '../stores/projects-store'

export function buildBusinessContext(brand: string): string {
  try {
    // Contacts snapshot — listContacts uses BRAND env var, no brand param
    const contacts = listContacts()
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const newContacts = contacts.filter(c => now - new Date(c.created_at).getTime() < weekMs)

    // Deals snapshot
    const deals = listDeals(brand)
    const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage))
    const nowDate = new Date()
    const wonThisMonth = deals.filter(d => {
      if (d.stage !== 'won') return false
      const updated = new Date(d.updated_at)
      return (
        updated.getMonth() === nowDate.getMonth() &&
        updated.getFullYear() === nowDate.getFullYear()
      )
    })
    // DealRecord.value is in cents (integer USD cents)
    const pipelineValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0)

    // Invoices snapshot — InvoiceRecord.total is a dollar float
    const invoices = listInvoices(brand)
    const unpaidInvoices = invoices.filter(i => i.status === 'sent')
    const unpaidValue = unpaidInvoices.reduce((s, i) => s + (i.total ?? 0), 0)

    // Appointments snapshot — field is starts_at, brand filtered via filters object
    const appointments = listAppointments({ brand })
    const upcoming = appointments
      .filter(a => new Date(a.starts_at) >= new Date())
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )
      .slice(0, 5)

    // Projects snapshot
    const projects = listProjects({ brand })
    const activeProjects = projects.filter(p => p.status === 'active')

    const fmtCents = (c: number) => `$${(c / 100).toFixed(0)}`
    const fmtDollars = (d: number) => `$${d.toFixed(0)}`

    const lines: string[] = [
      `## Live Business Snapshot (as of now)`,
      `- Total contacts: ${contacts.length} (${newContacts.length} added this week)`,
      `- Open deals: ${openDeals.length} | Pipeline value: ${fmtCents(pipelineValue)}`,
      `- Won this month: ${wonThisMonth.length} deals`,
      `- Unpaid invoices: ${unpaidInvoices.length} | Total unpaid: ${fmtDollars(unpaidValue)}`,
      `- Active projects: ${activeProjects.length}`,
    ]

    if (upcoming.length > 0) {
      lines.push(`- Upcoming appointments (next ${upcoming.length}):`)
      upcoming.forEach(a => {
        const dt = new Date(a.starts_at)
        const label = dt.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
        const time = dt.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
        lines.push(
          `  • ${label} ${time} — ${a.title}${a.contact_name ? ` (${a.contact_name})` : ''}`,
        )
      })
    } else {
      lines.push(`- No upcoming appointments`)
    }

    return lines.join('\n')
  } catch {
    return '' // fail silently — never break the chat
  }
}
