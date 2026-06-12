import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  LockIcon,
  Logout01Icon,
  Activity01Icon,
  Database01Icon,
  CloudServerIcon,
  Shield01Icon,
  Copy01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface VerifyResponse {
  ok: boolean
  brand: string
}

interface HealthResponse {
  uptime_seconds: number
  uptime_human: string
  memory_mb: { rss: number; heap_used: number; heap_total: number }
  node_version: string
  brand: string
  port: string
  env: string
}

interface StatsResponse {
  brand: string
  counts: Record<string, number>
  storage_mb: number
  data_dir: string
}

interface AuditEntry {
  id: string
  brand: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string
  entity_label?: string
  created_at: string
}

interface AuditResponse {
  entries: AuditEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function otherInstance(brand: string): { name: string; port: string; url: string } {
  if (brand === 'sc') return { name: 'HFM', port: '8788', url: 'http://localhost:8788/admin' }
  if (brand === 'hfm') return { name: 'SC', port: '8787', url: 'http://localhost:8787/admin' }
  return { name: 'Default', port: '8788', url: 'http://localhost:8788/admin' }
}

// ── Deploy Modal ──────────────────────────────────────────────────────────────

function DeployModal({ onClose }: { onClose: () => void }) {
  const cmds = `# 1. Copy the service file
sudo cp /etc/systemd/system/ai-os-sc.service /etc/systemd/system/ai-os-new.service

# 2. Edit the new service — set unique BRAND and API_PORT
sudo nano /etc/systemd/system/ai-os-new.service

# Required env vars:
# Environment=BRAND=new
# Environment=API_PORT=8789
# Environment=ADMIN_SECRET=<same-or-new-secret>
# Environment=AIOS_DATA_DIR=/var/lib/ai-os/new

# 3. Enable + start
sudo systemctl daemon-reload
sudo systemctl enable ai-os-new
sudo systemctl start ai-os-new

# 4. Check status
sudo systemctl status ai-os-new`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">Deploy a New Tenant Instance</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            ✕
          </button>
        </div>
        <p className="text-[12px] text-[var(--theme-muted)] mb-3">
          Each tenant is a separate systemd service with its own BRAND, port, and data directory.
        </p>
        <div
          className="relative rounded-xl border p-4 font-mono text-[11px] leading-relaxed whitespace-pre"
          style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)', overflowX: 'auto' }}
        >
          {cmds}
          <button
            onClick={() => { void navigator.clipboard.writeText(cmds); toast('Copied to clipboard') }}
            className="absolute right-2 top-2 rounded-lg p-1.5 opacity-60 hover:opacity-100 hover:bg-[var(--theme-hover)]"
            title="Copy"
          >
            <HugeiconsIcon icon={Copy01Icon} size={12} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
            style={{ background: 'var(--theme-accent)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card component ────────────────────────────────────────────────────────────

function Card({ title, icon, children, className }: {
  title: string
  icon: typeof LockIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('rounded-2xl border p-5', className)}
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--theme-accent)]">
          <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} />
        </span>
        <h3 className="text-[13px] font-semibold text-[var(--theme-text)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--theme-border)' }}>
      <span className="text-[12px] text-[var(--theme-muted)]">{label}</span>
      <span className="text-[12px] font-medium text-[var(--theme-text)]">{value}</span>
    </div>
  )
}

// ── Login Gate ────────────────────────────────────────────────────────────────

function LoginGate({ onAuthed }: { onAuthed: (secret: string) => void }) {
  const [secret, setSecret] = useState(() => localStorage.getItem('admin_secret') ?? '')
  const [checking, setChecking] = useState(false)

  async function verify() {
    if (!secret.trim()) { toast('Enter the admin secret', { type: 'error' }); return }
    setChecking(true)
    try {
      const r = await fetch('/api/admin/verify', { headers: { 'x-admin-secret': secret } })
      if (r.ok) {
        localStorage.setItem('admin_secret', secret)
        onAuthed(secret)
      } else {
        toast('Invalid admin secret', { type: 'error' })
      }
    } catch {
      toast('Could not reach server', { type: 'error' })
    }
    setChecking(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--theme-bg-grad)' }}>
      <div
        className="w-full max-w-sm rounded-2xl border p-8 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'var(--theme-accent-soft)' }}
          >
            <HugeiconsIcon icon={LockIcon} size={22} className="text-[var(--theme-accent)]" strokeWidth={1.8} />
          </div>
          <h1 className="text-[17px] font-bold text-[var(--theme-text)]">Admin Access</h1>
          <p className="text-[12px] text-[var(--theme-muted)] text-center">Enter your admin secret to continue</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void verify() }}
            placeholder="Admin secret"
            className="w-full rounded-xl border px-4 py-2.5 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2"
            style={{
              background: 'var(--theme-input)',
              borderColor: 'var(--theme-border)',
            }}
          />
          <button
            onClick={() => void verify()}
            disabled={checking}
            className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--theme-accent)' }}
          >
            {checking ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Admin Console ────────────────────────────────────────────────────────

function AdminConsole({ secret, brand, onLogout }: { secret: string; brand: string; onLogout: () => void }) {
  const [showDeploy, setShowDeploy] = useState(false)
  const headers = { 'x-admin-secret': secret }
  const other = otherInstance(brand)

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ['admin-health'],
    queryFn: () => fetch('/api/admin/health', { headers }).then(r => r.json()) as Promise<HealthResponse>,
    enabled: true,
    refetchInterval: 30_000,
  })

  const statsQuery = useQuery<StatsResponse>({
    queryKey: ['admin-stats', brand],
    queryFn: () => fetch(`/api/admin/tenants/${brand}/stats`, { headers }).then(r => r.json()) as Promise<StatsResponse>,
    enabled: true,
  })

  const auditQuery = useQuery<AuditResponse>({
    queryKey: ['admin-audit', brand],
    queryFn: () => fetch(`/api/admin/tenants/${brand}/audit`, { headers }).then(r => r.json()) as Promise<AuditResponse>,
    enabled: true,
  })

  const health = healthQuery.data
  const stats = statsQuery.data
  const audit = auditQuery.data

  const brandLabel = brand.toUpperCase()

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--theme-bg-grad)' }}>
      {showDeploy && <DeployModal onClose={() => setShowDeploy(false)} />}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--theme-accent-soft)' }}
          >
            <HugeiconsIcon icon={Shield01Icon} size={18} className="text-[var(--theme-accent)]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-[var(--theme-text)]">Admin Console</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">Super-admin panel</p>
          </div>
          <span
            className="ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: 'var(--theme-accent)' }}
          >
            {brandLabel}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] transition-colors"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <HugeiconsIcon icon={Logout01Icon} size={13} strokeWidth={1.8} />
          Logout
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mb-5">

        {/* Left column — This Instance */}
        <div className="space-y-5">
          {/* Health card */}
          <Card title="System Health" icon={Activity01Icon}>
            {health ? (
              <div>
                <StatRow label="Uptime" value={health.uptime_human} />
                <StatRow label="Memory RSS" value={`${health.memory_mb.rss} MB`} />
                <StatRow label="Heap Used" value={`${health.memory_mb.heap_used} / ${health.memory_mb.heap_total} MB`} />
                <StatRow label="Node" value={health.node_version} />
                <StatRow label="Port" value={health.port} />
                <StatRow label="Environment" value={health.env} />
                <StatRow label="Brand" value={health.brand.toUpperCase()} />
              </div>
            ) : (
              <p className="text-[12px] text-[var(--theme-muted)]">
                {healthQuery.isLoading ? 'Loading…' : 'Unavailable'}
              </p>
            )}
          </Card>

          {/* Stats card */}
          <Card title={`${brandLabel} Tenant Stats`} icon={Database01Icon}>
            {stats ? (
              <div>
                {Object.entries(stats.counts).map(([k, v]) => (
                  <StatRow key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                ))}
                <StatRow label="Storage" value={`${stats.storage_mb} MB`} />
                <div className="mt-3 rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--theme-muted)] truncate" style={{ background: 'var(--theme-input)' }}>
                  {stats.data_dir}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[var(--theme-muted)]">
                {statsQuery.isLoading ? 'Loading…' : 'Unavailable'}
              </p>
            )}
          </Card>
        </div>

        {/* Right column — Other Tenant */}
        <div className="space-y-5">
          <Card title="Other Tenant" icon={CloudServerIcon}>
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[16px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--theme-accent), #000)' }}
              >
                {other.name}
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[var(--theme-text)]">{other.name} Instance</p>
                <p className="text-[12px] text-[var(--theme-muted)]">Port {other.port}</p>
              </div>
              <a
                href={other.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                Open {other.name}
              </a>
              <p className="text-[10px] text-[var(--theme-muted)] text-center px-4">
                Direct stats require cross-instance API access. Open the instance to view its admin panel.
              </p>
            </div>
          </Card>

          {/* Add tenant */}
          <Card title="Instance Management" icon={Shield01Icon}>
            <p className="text-[12px] text-[var(--theme-muted)] mb-4">
              Each tenant runs as a separate systemd service with its own brand, port, and data directory.
            </p>
            <button
              onClick={() => setShowDeploy(true)}
              className="w-full rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-[var(--theme-accent-soft)]"
              style={{
                borderColor: 'var(--theme-accent)',
                color: 'var(--theme-accent)',
              }}
            >
              + Deploy New Tenant
            </button>
          </Card>
        </div>
      </div>

      {/* Audit log */}
      <Card title="Recent Audit Log" icon={Activity01Icon}>
        {audit && audit.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
                  {['Time', 'Actor', 'Action', 'Entity'].map(col => (
                    <th key={col} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.entries.map(e => (
                  <tr
                    key={e.id}
                    className="border-b last:border-0 hover:bg-[var(--theme-hover)] transition-colors"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <td className="py-2 pr-4 text-[var(--theme-muted)]">{relativeTime(e.created_at)}</td>
                    <td className="py-2 pr-4 font-medium text-[var(--theme-text)]">{e.actor}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                          e.action.includes('delete') || e.action.includes('removed')
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : e.action.includes('create') || e.action.includes('added')
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-[var(--theme-accent-soft)] text-[var(--theme-accent)]',
                        )}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 text-[var(--theme-muted)]">
                      {e.entity_label ?? e.entity_type}
                      {e.entity_id && (
                        <span className="ml-1 text-[10px] opacity-50">#{e.entity_id.slice(0, 6)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-[12px] text-[var(--theme-muted)]">
            {auditQuery.isLoading ? 'Loading…' : 'No audit entries yet.'}
          </p>
        )}
      </Card>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export function AdminScreen() {
  const [secret, setSecret] = useState(() => localStorage.getItem('admin_secret') ?? '')
  const [authed, setAuthed] = useState(false)
  const [brand, setBrand] = useState('default')

  // Auto-verify if we already have a stored secret
  const verifyQuery = useQuery<VerifyResponse>({
    queryKey: ['admin-verify', secret],
    queryFn: async () => {
      const r = await fetch('/api/admin/verify', { headers: { 'x-admin-secret': secret } })
      return r.json() as Promise<VerifyResponse>
    },
    enabled: secret !== '' && !authed,
    retry: false,
  })

  if (!authed && verifyQuery.data?.ok && !verifyQuery.isLoading) {
    setAuthed(true)
    setBrand(verifyQuery.data.brand)
  }

  function handleAuthed(s: string) {
    setSecret(s)
    // Trigger re-verify with new secret via verify endpoint response
    fetch('/api/admin/verify', { headers: { 'x-admin-secret': s } })
      .then(r => r.json())
      .then((d: unknown) => {
        const data = d as VerifyResponse
        if (data.ok) { setAuthed(true); setBrand(data.brand) }
      })
      .catch(() => undefined)
  }

  function handleLogout() {
    localStorage.removeItem('admin_secret')
    setSecret('')
    setAuthed(false)
    setBrand('default')
  }

  if (!authed) {
    return <LoginGate onAuthed={handleAuthed} />
  }

  return <AdminConsole secret={secret} brand={brand} onLogout={handleLogout} />
}
