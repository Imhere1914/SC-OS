/**
 * Universal search — Sprint 73 Command Palette backend.
 * GET /api/search?q=term[&brand=xxx]
 * Queries contacts, deals, invoices, projects simultaneously.
 */
import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { listContacts } from '../stores/contacts-store'
import { listDeals } from '../stores/deals-store'
import { listInvoices } from '../stores/invoices-store'
import { listProjects } from '../stores/projects-store'

export interface SearchResult {
  id: string
  type: 'contact' | 'deal' | 'invoice' | 'project' | 'nav'
  title: string
  subtitle?: string
  meta?: string
  url: string
  icon?: string
}

export function registerSearch(app: Hono): void {
  app.get('/api/search', (c) => {
    const brand = getBrandId(c)
    const q = (c.req.query('q') ?? '').toLowerCase().trim()
    if (!q || q.length < 2) return c.json({ results: [], query: q })

    const results: SearchResult[] = []

    try {
      listContacts({ search: q })
        .filter((ct) => ct.brand === brand || ct.brand === 'default' || brand === 'default')
        .slice(0, 5)
        .forEach((ct) =>
          results.push({
            id: ct.id,
            type: 'contact',
            title: ct.name,
            subtitle: ct.company ?? ct.email ?? '',
            meta: ct.stage,
            url: `/contacts/${ct.id}`,
            icon: '👤',
          }),
        )
    } catch { /* skip */ }

    try {
      listDeals(brand)
        .filter((d) => d.title.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((d) =>
          results.push({
            id: d.id,
            type: 'deal',
            title: d.title,
            subtitle: d.contact_name ?? '',
            meta: d.stage,
            url: `/deals`,
            icon: '💰',
          }),
        )
    } catch { /* skip */ }

    try {
      listInvoices(brand)
        .filter(
          (i) =>
            i.invoice_number?.toLowerCase().includes(q) ||
            i.contact_name?.toLowerCase().includes(q),
        )
        .slice(0, 4)
        .forEach((i) =>
          results.push({
            id: i.id,
            type: 'invoice',
            title: `Invoice ${i.invoice_number ?? i.id.slice(0, 8)}`,
            subtitle: i.contact_name ?? '',
            meta: i.status,
            url: `/payments`,
            icon: '🧾',
          }),
        )
    } catch { /* skip */ }

    try {
      listProjects({ brand })
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.contact_name ?? '').toLowerCase().includes(q),
        )
        .slice(0, 4)
        .forEach((p) =>
          results.push({
            id: p.id,
            type: 'project',
            title: p.name,
            subtitle: p.contact_name ?? '',
            meta: p.status,
            url: `/projects`,
            icon: '📋',
          }),
        )
    } catch { /* skip */ }

    return c.json({ results: results.slice(0, 15), query: q })
  })
}
