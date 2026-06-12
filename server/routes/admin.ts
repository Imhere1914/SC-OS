import type { Context } from 'hono'
import type { Hono } from 'hono'
import { existsSync, readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import { listAudit } from '../stores/audit-store'

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''
const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function requireAdmin(c: Context): boolean {
  const secret = c.req.header('x-admin-secret') ?? c.req.query('secret')
  return ADMIN_SECRET !== '' && secret === ADMIN_SECRET
}

export function registerAdmin(app: Hono) {
  // Auth check
  app.get('/api/admin/verify', (c) => {
    if (!requireAdmin(c)) return c.json({ ok: false }, 401)
    return c.json({ ok: true, brand: process.env.BRAND ?? 'default' })
  })

  // Tenant stats — counts records in each data file for a given brand
  app.get('/api/admin/tenants/:brand/stats', (c) => {
    if (!requireAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const brand = c.req.param('brand')

    const countFile = (name: string): number => {
      const path = join(DATA_DIR, `${name}-${brand}.json`)
      if (!existsSync(path)) return 0
      try {
        const data = JSON.parse(readFileSync(path, 'utf8')) as unknown
        return Array.isArray(data) ? data.length : Object.keys(data as Record<string, unknown>).length
      } catch { return 0 }
    }

    const storageMb = (): number => {
      try {
        let total = 0
        const walk = (dir: string) => {
          if (!existsSync(dir)) return
          for (const f of readdirSync(dir)) {
            const full = join(dir, f)
            const s = statSync(full)
            if (s.isDirectory()) walk(full)
            else total += s.size
          }
        }
        walk(DATA_DIR)
        return Math.round(total / 1024 / 1024 * 10) / 10
      } catch { return 0 }
    }

    return c.json({
      brand,
      counts: {
        contacts: countFile('contacts'),
        conversations: countFile('conversations'),
        deals: countFile('deals'),
        invoices: countFile('invoices'),
        projects: countFile('projects'),
        campaigns: countFile('campaigns'),
        appointments: countFile('appointments'),
        forms: countFile('forms'),
        documents: countFile('documents'),
        audit: countFile('audit'),
      },
      storage_mb: storageMb(),
      data_dir: DATA_DIR,
    })
  })

  // Recent audit log entries (last 20)
  app.get('/api/admin/tenants/:brand/audit', (c) => {
    if (!requireAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const brand = c.req.param('brand')
    try {
      const entries = listAudit(brand, { limit: 20 })
      return c.json({ entries })
    } catch { return c.json({ entries: [] }) }
  })

  // System health — uptime + memory
  app.get('/api/admin/health', (c) => {
    if (!requireAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const uptime = process.uptime()
    const mem = process.memoryUsage()
    return c.json({
      uptime_seconds: Math.round(uptime),
      uptime_human: fmtUptime(uptime),
      memory_mb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heap_used: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total: Math.round(mem.heapTotal / 1024 / 1024),
      },
      node_version: process.version,
      brand: process.env.BRAND ?? 'default',
      port: process.env.API_PORT ?? '8787',
      env: process.env.NODE_ENV ?? 'development',
    })
  })
}

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
