import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Settings02Icon,
  Moon02Icon,
  Sun03Icon,
  Notification01Icon,
  PlugSocketIcon,
  KeyboardIcon,
  UserSharingIcon,
  Copy01Icon,
  Delete01Icon,
  Add01Icon,
  Audit01Icon,
  FilterIcon,
  Key01Icon,
  Clock01Icon,
  AiBrain01Icon,
} from '@hugeicons/core-free-icons'
import { useTheme } from '@/hooks/useTheme'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { subscribeToPush } from '@/components/PushOptIn'
import { toast } from '@/components/toast'
import { VOICE_MODELS, getVoiceModel } from '@/lib/voice-models'

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const sectionCls = 'rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] overflow-hidden'
const sectionStyle: React.CSSProperties = { backdropFilter: 'blur(10px)' }

const primaryBtnCls = 'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const dangerGhostBtnCls = 'rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all duration-150 disabled:opacity-40'
const dangerGhostBtnStyle: React.CSSProperties = {
  color: '#ef4444',
  background: 'color-mix(in srgb, #ef4444 8%, transparent)',
  border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)',
}

function timeAgo(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    if (Number.isNaN(diff)) return d
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return 'just now'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    const mo = Math.floor(day / 30)
    if (mo < 12) return `${mo}mo ago`
    return `${Math.floor(mo / 12)}y ago`
  } catch { return d }
}

// Gradient icon chip + uppercase section title
function SectionHeader({ icon, title, color, right }: {
  icon: typeof Settings02Icon
  title: string
  color?: string
  right?: React.ReactNode
}) {
  const c = color ?? 'var(--theme-accent)'
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--theme-border)] px-4 py-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 65%, #000))`,
          boxShadow: `0 2px 8px color-mix(in srgb, ${c} 38%, transparent)`,
        }}
      >
        <HugeiconsIcon icon={icon} size={13} className="text-white" />
      </span>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text)]">{title}</h2>
      {right}
    </div>
  )
}

// Colored dot + tinted pill status badge
function DotBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

// Modern pill switch (pure CSS, presentational)
function PillSwitch({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-150"
      style={{
        background: checked ? ACCENT_GRADIENT : 'var(--theme-border)',
        boxShadow: checked ? ACCENT_GLOW : undefined,
      }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// Modal header: gradient icon chip + bold title + muted subtitle
function ModalHeader({ icon, title, subtitle, onClose }: {
  icon: typeof Settings02Icon
  title: string
  subtitle?: string
  onClose?: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3.5" style={{ borderColor: 'var(--theme-border)' }}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        <HugeiconsIcon icon={icon} size={16} className="text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-[var(--theme-text)]">{title}</h3>
        {subtitle && <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="rounded-lg p-1 text-lg leading-none text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">&times;</button>
      )}
    </div>
  )
}

type IntegrationStatus = {
  resend: { configured: boolean; from: string | null; note: string }
  stripe: { configured: boolean; note: string }
  openrouter: { configured: boolean; note: string }
  google_calendar: { configured: boolean; note: string }
  brand: string
}

async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const res = await fetch('/api/integrations/status')
  if (!res.ok) throw new Error('Failed to load')
  return res.json() as Promise<IntegrationStatus>
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok
    ? <DotBadge color="#10b981" label={label} />
    : <DotBadge color="#f59e0b" label={label} />
}

const INTEGRATIONS = [
  {
    key: 'resend' as const,
    name: 'Resend (Email)',
    description: 'Powers campaign sending and transactional email.',
    envVars: ['RESEND_API_KEY', 'CAMPAIGN_FROM_EMAIL'],
    docs: 'https://resend.com/docs',
  },
  {
    key: 'stripe' as const,
    name: 'Stripe (Payments)',
    description: 'Webhook handler for payment events and invoice updates.',
    envVars: ['STRIPE_WEBHOOK_SECRET'],
    docs: 'https://stripe.com/docs/webhooks',
  },
  {
    key: 'openrouter' as const,
    name: 'OpenRouter (AI)',
    description: 'Powers the AI assistant, campaign writer, and contact insights.',
    envVars: ['OPENROUTER_API_KEY'],
    docs: 'https://openrouter.ai',
  },
  {
    key: 'google_calendar' as const,
    name: 'Google Calendar',
    description: 'Syncs appointments and availability (HFM).',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    docs: 'https://developers.google.com/calendar',
  },
]

// ── Portal token types ────────────────────────────────────────────────────────

type PortalToken = {
  id: string
  contact_id: string
  brand: string
  label: string
  created_at: string
  expires_at?: string
  last_accessed_at?: string
  access_count: number
  show_projects: boolean
  show_invoices: boolean
  show_proposals: boolean
}

type ContactOption = { id: string; name: string; email: string | null }

// ── Create Portal Modal ───────────────────────────────────────────────────────

function CreatePortalModal({
  brand,
  onClose,
  onCreated,
}: {
  brand: string
  onClose: () => void
  onCreated: () => void
}) {
  const [label, setLabel] = useState('')
  const [contactId, setContactId] = useState('')
  const [showProjects, setShowProjects] = useState(true)
  const [showInvoices, setShowInvoices] = useState(true)
  const [showProposals, setShowProposals] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const contactsQuery = useQuery<ContactOption[]>({
    queryKey: ['contacts-simple'],
    queryFn: async () => {
      const res = await fetch('/api/contacts')
      if (!res.ok) return []
      const data = (await res.json()) as { contacts?: ContactOption[] }
      return (data.contacts ?? []).map(c => ({ id: c.id, name: c.name, email: c.email }))
    },
    staleTime: 30_000,
  })

  const contacts = contactsQuery.data ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!contactId) { setError('Please select a contact.'); return }
    if (!label.trim()) { setError('Please enter a label.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/portal/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          contact_id: contactId,
          label: label.trim(),
          show_projects: showProjects,
          show_invoices: showInvoices,
          show_proposals: showProposals,
          expires_at: expiresAt || undefined,
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to create portal link')
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={UserSharingIcon}
          title="Create Portal Link"
          subtitle="Share a token-gated client view"
          onClose={onClose}
        />
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Contact */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contact</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
            >
              <option value="">Select a contact…</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Jane Smith Portal"
              className="w-full rounded-lg border px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
            />
          </div>

          {/* Show toggles */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Visible sections</p>
            <div className="space-y-2">
              {[
                { label: 'Projects', value: showProjects, set: setShowProjects },
                { label: 'Invoices', value: showInvoices, set: setShowInvoices },
                { label: 'Proposals', value: showProposals, set: setShowProposals },
              ].map(({ label: lbl, value, set }) => (
                <label key={lbl} className="flex cursor-pointer items-center gap-2.5">
                  <PillSwitch checked={value} onToggle={() => set(v => !v)} label={lbl} />
                  <span className="text-xs text-[var(--theme-text)]">{lbl}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Expiry date <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              style={primaryBtnStyle}
            >
              {saving ? 'Creating…' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Client Portals section ────────────────────────────────────────────────────

function ClientPortalsSection({ brand }: { brand: string }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const tokensQuery = useQuery<PortalToken[]>({
    queryKey: ['portal-tokens', brand],
    queryFn: async () => {
      const res = await fetch(`/api/portal/tokens?brand=${brand}`)
      if (!res.ok) return []
      return res.json() as Promise<PortalToken[]>
    },
    staleTime: 15_000,
  })

  const tokens = tokensQuery.data ?? []

  const copyLink = async (tokenId: string) => {
    const url = `${window.location.origin}/portal/${tokenId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(tokenId)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* fallback silent */ }
  }

  const deleteToken = async (tokenId: string) => {
    if (!confirm('Delete this portal link? The client will no longer be able to access it.')) return
    setDeletingId(tokenId)
    try {
      await fetch(`/api/portal/tokens/${tokenId}?brand=${brand}`, { method: 'DELETE' })
      await queryClient.invalidateQueries({ queryKey: ['portal-tokens', brand] })
    } finally {
      setDeletingId(null)
    }
  }

  const fmtDate = (d?: string) => {
    if (!d) return null
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d }
  }

  return (
    <>
      {showCreate && (
        <CreatePortalModal
          brand={brand}
          onClose={() => setShowCreate(false)}
          onCreated={() => { void queryClient.invalidateQueries({ queryKey: ['portal-tokens', brand] }) }}
        />
      )}

      <section className={sectionCls} style={sectionStyle}>
        <SectionHeader
          icon={UserSharingIcon}
          title="Client Portals"
          color="#0ea5e9"
          right={
            <span className="ml-auto">
              <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={11} />
                Create Portal Link
              </button>
            </span>
          }
        />

        {tokensQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--theme-hover)]" />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[var(--theme-muted)]">No portal links yet.</p>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              Create a link to share a token-gated view of projects, invoices, and proposals with a client.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--theme-border)]">
            {tokens.map(token => {
              const expired = token.expires_at && new Date(token.expires_at) < new Date()
              return (
                <div key={token.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--theme-text)]">{token.label}</p>
                      {expired && <DotBadge color="#f59e0b" label="Expired" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">
                      {[
                        token.show_projects && 'Projects',
                        token.show_invoices && 'Invoices',
                        token.show_proposals && 'Proposals',
                      ].filter(Boolean).join(' · ')}
                      {' · '}
                      {token.access_count} {token.access_count === 1 ? 'view' : 'views'}
                      {token.expires_at && ` · Expires ${fmtDate(token.expires_at)}`}
                    </p>
                    <code className="mt-1 block truncate text-[10px] text-[var(--theme-muted)]">
                      {window.location.origin}/portal/{token.id}
                    </code>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => void copyLink(token.id)}
                      title="Copy link"
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                        copied === token.id
                          ? 'text-[var(--theme-success)]'
                          : 'text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]',
                      )}
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={12} />
                      {copied === token.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => void deleteToken(token.id)}
                      disabled={deletingId === token.id}
                      title="Delete portal link"
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150 disabled:opacity-40"
                      style={dangerGhostBtnStyle}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

// ── Push Notifications section ────────────────────────────────────────────────

function PushNotificationsSection({ brand }: { brand: string }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [permState, setPermState] = useState<NotificationPermission | null>(null)

  const statusQuery = useQuery<{ subscriptions: number; vapid_configured: boolean }>({
    queryKey: ['push-status', brand],
    queryFn: async () => {
      const res = await fetch('/api/push/status')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ subscriptions: number; vapid_configured: boolean }>
    },
    staleTime: 15_000,
  })

  const pushStatus = statusQuery.data

  // Check permission on mount
  useState(() => {
    if ('Notification' in window) setPermState(Notification.permission)
  })

  const handleTestPush = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = (await res.json()) as { sent: number; failed: number }
      setTestResult(`Sent: ${data.sent}, Failed: ${data.failed}`)
    } catch {
      setTestResult('Error sending test push')
    } finally {
      setTesting(false)
    }
  }

  const handleEnable = async () => {
    setEnabling(true)
    try {
      const result = await Notification.requestPermission()
      setPermState(result)
      if (result === 'granted') {
        await subscribeToPush()
        await statusQuery.refetch()
      }
    } catch {
      /* silent */
    } finally {
      setEnabling(false)
    }
  }

  const isPushSupported = typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window

  return (
    <section className={sectionCls} style={sectionStyle}>
      <SectionHeader
        icon={Notification01Icon}
        title="Push Notifications"
        color="#8b5cf6"
        right={pushStatus && (
          <span className="ml-auto text-[10px] tabular-nums text-[var(--theme-muted)]">
            {pushStatus.subscriptions} active {pushStatus.subscriptions === 1 ? 'subscription' : 'subscriptions'}
          </span>
        )}
      />

      {!isPushSupported ? (
        <div className="p-4">
          <p className="text-xs text-[var(--theme-muted)]">Push notifications are not supported in this browser.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--theme-border)]">
          {/* Permission / Enable row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-[var(--theme-text)]">Browser permission</p>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {permState === 'granted'
                  ? 'Notifications are enabled for this browser.'
                  : permState === 'denied'
                  ? 'Permission denied. Update in browser settings.'
                  : 'Grant permission to receive push notifications.'}
              </p>
            </div>
            {permState !== 'granted' && permState !== 'denied' && (
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
                style={primaryBtnStyle}
              >
                {enabling ? 'Enabling…' : 'Enable Notifications'}
              </button>
            )}
            {permState === 'granted' && <DotBadge color="#10b981" label="Enabled" />}
            {permState === 'denied' && <DotBadge color="#ef4444" label="Blocked" />}
          </div>

          {/* Test push row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-[var(--theme-text)]">Send test notification</p>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {testResult ?? 'Sends a test push to all active subscriptions for this brand.'}
              </p>
            </div>
            <button
              onClick={handleTestPush}
              disabled={testing || !pushStatus || pushStatus.subscriptions === 0}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)] disabled:opacity-40"
            >
              {testing ? 'Sending…' : 'Test Push'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string
  brand: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string
  entity_label?: string
  details?: Record<string, unknown>
  ip?: string
  user_agent?: string
  created_at: string
}

const ENTITY_TYPES = [
  { value: '', label: 'All entity types' },
  { value: 'contact', label: 'Contact' },
  { value: 'deal', label: 'Deal' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'task', label: 'Task' },
  { value: 'form', label: 'Form' },
]

function actionColor(action: string): string {
  if (action.includes('created') || action.includes('added')) return '#10b981'
  if (action.includes('deleted') || action.includes('removed') || action.includes('revoked')) return '#ef4444'
  if (action.includes('updated') || action.includes('changed') || action.includes('sent')) return '#3b82f6'
  return '#94a3b8'
}

function AuditDetailsCell({ details }: { details?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  if (!details || Object.keys(details).length === 0) return <span className="text-[var(--theme-muted)]">—</span>
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] text-[var(--theme-accent)] hover:underline"
      >
        {open ? 'hide' : 'show'}
      </button>
      {open && (
        <pre className="mt-1 max-w-[280px] overflow-x-auto rounded bg-[var(--theme-hover)] p-2 text-[9px] text-[var(--theme-text)]">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  )
}

function AuditLogSection({ brand }: { brand: string }) {
  const [entityType, setEntityType] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [enabled, setEnabled] = useState(false)

  const buildParams = () => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    if (actor.trim()) params.set('actor', actor.trim())
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return params.toString()
  }

  const auditQuery = useQuery<{ entries: AuditEntry[]; total: number }>({
    queryKey: ['audit', brand, entityType, actor, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/audit?${buildParams()}`)
      if (!res.ok) throw new Error('Failed to load audit log')
      return res.json() as Promise<{ entries: AuditEntry[]; total: number }>
    },
    enabled,
    staleTime: 10_000,
  })

  const entries = auditQuery.data?.entries ?? []

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return d }
  }

  const handleLoad = () => {
    setEnabled(true)
    void auditQuery.refetch()
  }

  return (
    <section className={sectionCls} style={sectionStyle}>
      <SectionHeader
        icon={Audit01Icon}
        title="Platform Audit Log"
        color="#f97316"
        right={auditQuery.data && (
          <span className="ml-auto text-[10px] tabular-nums text-[var(--theme-muted)]">
            {auditQuery.data.total} {auditQuery.data.total === 1 ? 'entry' : 'entries'}
          </span>
        )}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[var(--theme-muted)]">Entity type</label>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
          >
            {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[var(--theme-muted)]">Actor</label>
          <input
            type="text"
            value={actor}
            onChange={e => setActor(e.target.value)}
            placeholder="system, api, name…"
            className="w-36 rounded-lg border px-2 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[var(--theme-muted)]">From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-[var(--theme-muted)]">To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
          />
        </div>
        <button
          onClick={handleLoad}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px"
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={FilterIcon} size={11} />
          Load
        </button>
      </div>

      {/* Table */}
      {!enabled ? (
        <div className="p-6 text-center">
          <p className="text-xs text-[var(--theme-muted)]">Apply filters and click Load to view audit entries.</p>
        </div>
      ) : auditQuery.isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--theme-hover)]" />)}
        </div>
      ) : auditQuery.isError ? (
        <div className="p-4 text-center text-xs text-red-500">Failed to load audit log.</div>
      ) : entries.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--theme-muted)]">No audit entries found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-hover)]">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Timestamp</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Actor</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Action</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Entity</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={cn('border-b border-[var(--theme-border)] transition-colors hover:bg-[var(--theme-hover)]', i % 2 !== 0 ? 'bg-[var(--theme-hover)]/40' : '')}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-[var(--theme-muted)]" title={fmtDate(entry.created_at)}>
                    <div className="flex items-center gap-1">
                      <HugeiconsIcon icon={Clock01Icon} size={10} className="shrink-0" />
                      {timeAgo(entry.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-[var(--theme-text)]">{entry.actor}</td>
                  <td className="px-4 py-2.5">
                    <DotBadge color={actionColor(entry.action)} label={entry.action} />
                  </td>
                  <td className="px-4 py-2.5 text-[var(--theme-text)]">
                    <span className="font-medium">{entry.entity_type}</span>
                    {entry.entity_label && (
                      <span className="ml-1 text-[var(--theme-muted)]">· {entry.entity_label}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <AuditDetailsCell details={entry.details} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── API Key Management ────────────────────────────────────────────────────────

type ApiKey = {
  id: string
  brand: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at?: string
  created_at: string
  expires_at?: string
  active: boolean
}

const SCOPES = [
  { value: '*', label: 'Full Access' },
  { value: 'contacts:read', label: 'Read Contacts' },
  { value: 'contacts:write', label: 'Write Contacts' },
  { value: 'deals:read', label: 'Read Deals' },
  { value: 'deals:write', label: 'Write Deals' },
  { value: 'invoices:read', label: 'Read Invoices' },
  { value: 'invoices:write', label: 'Write Invoices' },
  { value: 'campaigns:read', label: 'Read Campaigns' },
  { value: 'conversations:read', label: 'Read Conversations' },
]

function CreateApiKeyModal({
  brand: _brand,
  onClose,
  onCreated,
}: {
  brand: string
  onClose: () => void
  onCreated: (rawKey: string) => void
}) {
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleScope = (value: string) => {
    if (value === '*') {
      setSelectedScopes(prev => prev.includes('*') ? [] : ['*'])
      return
    }
    setSelectedScopes(prev =>
      prev.includes(value)
        ? prev.filter(s => s !== value)
        : [...prev.filter(s => s !== '*'), value],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    if (selectedScopes.length === 0) { setError('Select at least one scope.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          expires_at: expiresAt || undefined,
        }),
      })
      const data = (await res.json()) as { raw_key?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to create API key'); return }
      onCreated(data.raw_key ?? '')
      onClose()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={Key01Icon}
          title="Create API Key"
          subtitle="Authenticate integrations and automations"
          onClose={onClose}
        />
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Zapier Integration"
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Scopes</p>
            <div className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
              {SCOPES.map(scope => (
                <label key={scope.value} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="rounded"
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  <span className="text-xs text-[var(--theme-text)]">{scope.label}</span>
                  <code className="ml-auto rounded bg-[var(--theme-card)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--theme-muted)]">
                    {scope.value}
                  </code>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Expiry date <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              style={{ background: 'var(--theme-input)', borderColor: 'var(--theme-border)' }}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-xs text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              style={primaryBtnStyle}
            >
              {saving ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RawKeyRevealModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast('API key copied to clipboard')
    } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={Key01Icon}
          title="Your API Key"
          subtitle="One-time reveal — shown only once"
        />
        <div className="space-y-4 p-4">
          <div
            className="flex items-start gap-2 rounded-xl border p-3 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, #f59e0b 10%, var(--theme-card))',
              borderColor: 'color-mix(in srgb, #f59e0b 35%, transparent)',
              color: '#f59e0b',
            }}
          >
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#f59e0b' }} />
            Save this now — the key will not be shown again.
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Raw key</p>
          <div
            className="flex items-center gap-2 rounded-xl border p-3"
            style={{ background: 'var(--theme-hover)', borderColor: 'var(--theme-border)' }}
          >
            <code className="flex-1 break-all font-mono text-xs text-[var(--theme-text)]">{rawKey}</code>
            <button
              onClick={handleCopy}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                copied
                  ? 'text-[var(--theme-success)]'
                  : 'text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]',
              )}
            >
              <HugeiconsIcon icon={Copy01Icon} size={12} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px"
              style={primaryBtnStyle}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApiKeysSection({ brand }: { brand: string }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const keysQuery = useQuery<{ keys: ApiKey[] }>({
    queryKey: ['api-keys', brand],
    queryFn: async () => {
      const res = await fetch('/api/api-keys')
      if (!res.ok) throw new Error('Failed to load')
      return res.json() as Promise<{ keys: ApiKey[] }>
    },
    staleTime: 30_000,
  })

  const keys = keysQuery.data?.keys ?? []

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Integrations using it will stop working.')) return
    setActionId(id)
    try {
      const res = await fetch(`/api/api-keys/${id}/revoke`, { method: 'DELETE' })
      if (res.ok) {
        toast('API key revoked')
        await queryClient.invalidateQueries({ queryKey: ['api-keys', brand] })
      } else {
        toast('Failed to revoke key')
      }
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this API key?')) return
    setActionId(id)
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast('API key deleted')
        await queryClient.invalidateQueries({ queryKey: ['api-keys', brand] })
      } else {
        toast('Failed to delete key')
      }
    } finally {
      setActionId(null)
    }
  }

  const fmtDate = (d?: string) => {
    if (!d) return null
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d }
  }

  return (
    <>
      {showCreate && (
        <CreateApiKeyModal
          brand={brand}
          onClose={() => setShowCreate(false)}
          onCreated={(rawKey) => {
            void queryClient.invalidateQueries({ queryKey: ['api-keys', brand] })
            setRevealedKey(rawKey)
          }}
        />
      )}
      {revealedKey && (
        <RawKeyRevealModal rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}

      <section className={sectionCls} style={sectionStyle}>
        <SectionHeader
          icon={Key01Icon}
          title="API Keys"
          color="#10b981"
          right={
            <span className="ml-auto">
              <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={11} />
                Create API Key
              </button>
            </span>
          }
        />

        {keysQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--theme-hover)]" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[var(--theme-muted)]">No API keys yet.</p>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              Create a key to authenticate integrations and automate workflows.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--theme-border)]">
            {keys.map(key => {
              const isExpired = key.expires_at && new Date(key.expires_at) < new Date()
              return (
                <div key={key.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-border)]"
                    style={{ background: key.active && !isExpired ? 'color-mix(in srgb, var(--theme-success) 12%, transparent)' : 'var(--theme-hover)' }}
                  >
                    <HugeiconsIcon icon={Key01Icon} size={14}
                      style={{ color: key.active && !isExpired ? 'var(--theme-success)' : 'var(--theme-muted)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--theme-text)]">{key.name}</p>
                      {!key.active ? (
                        <DotBadge color="#ef4444" label="Revoked" />
                      ) : isExpired ? (
                        <DotBadge color="#f59e0b" label="Expired" />
                      ) : (
                        <DotBadge color="#10b981" label="Active" />
                      )}
                    </div>
                    <code
                      className="mt-1 inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                        color: 'var(--theme-accent)',
                        border: '1px solid color-mix(in srgb, var(--theme-accent) 22%, transparent)',
                      }}
                    >
                      {key.key_prefix}••••••••••••••••••••••
                    </code>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {key.scopes.map(s => (
                        <span key={s} className="rounded-full bg-[var(--theme-hover)] px-2 py-0.5 font-mono text-[9px] text-[var(--theme-muted)]">
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
                      Created {fmtDate(key.created_at)}
                      {key.last_used_at && ` · Last used ${fmtDate(key.last_used_at)}`}
                      {key.expires_at && ` · Expires ${fmtDate(key.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {key.active && !isExpired && (
                      <button
                        onClick={() => void handleRevoke(key.id)}
                        disabled={actionId === key.id}
                        className={dangerGhostBtnCls}
                        style={dangerGhostBtnStyle}
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(key.id)}
                      disabled={actionId === key.id}
                      title="Delete"
                      className={cn(dangerGhostBtnCls, 'flex items-center justify-center')}
                      style={dangerGhostBtnStyle}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

// ── Settings Screen ───────────────────────────────────────────────────────────

// ── Social Channels (env-driven, per-brand) ──────────────────────────────────

type SocialChannelKey = 'facebook' | 'instagram' | 'linkedin' | 'tiktok'

const SOCIAL_CHANNELS: Array<{
  key: SocialChannelKey
  name: string
  envVars: string[]
  note: string
}> = [
  {
    key: 'facebook',
    name: 'Facebook Page',
    envVars: ['FB_PAGE_ID_{BRAND}', 'FB_PAGE_TOKEN_{BRAND}'],
    note: 'Posts to the Page feed (or /photos when an image is attached).',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    envVars: ['IG_USER_ID_{BRAND}', 'FB_PAGE_TOKEN_{BRAND}'],
    note: 'Reuses the Facebook Page token. Requires a public image URL.',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    envVars: ['LINKEDIN_TOKEN_{BRAND}', 'LINKEDIN_ORG_URN_{BRAND}'],
    note: 'Publishes an organization text share via the ugcPosts API.',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    envVars: ['TIKTOK_TOKEN_{BRAND}'],
    note: 'Video-only. A text/image-only post is rejected with a clear error.',
  },
]

function SocialChannelsSection({ brand }: { brand: string }) {
  const channelsQuery = useQuery({
    queryKey: ['social-channels', brand],
    queryFn: async (): Promise<Record<SocialChannelKey, boolean>> => {
      const res = await fetch(`/api/social/channels?brand=${encodeURIComponent(brand)}`)
      if (!res.ok) return { facebook: false, instagram: false, linkedin: false, tiktok: false }
      const data = (await res.json()) as { channels?: Partial<Record<SocialChannelKey, boolean>> }
      return {
        facebook: Boolean(data.channels?.facebook),
        instagram: Boolean(data.channels?.instagram),
        linkedin: Boolean(data.channels?.linkedin),
        tiktok: Boolean(data.channels?.tiktok),
      }
    },
    staleTime: 30_000,
  })
  const status = channelsQuery.data

  return (
    <section className={sectionCls} style={sectionStyle}>
      <SectionHeader
        icon={PlugSocketIcon}
        title="Social Channels"
        color="#E1306C"
        right={
          <span className="ml-auto text-[10px] text-[var(--theme-muted)]">
            Tokens set via <code className="rounded bg-[var(--theme-hover)] px-1 font-mono">.env</code> on the server (per brand)
          </span>
        }
      />
      <div className="divide-y divide-[var(--theme-border)]">
        {SOCIAL_CHANNELS.map((ch) => {
          const ok = status?.[ch.key] ?? false
          return (
            <div key={ch.key} className="flex items-start gap-4 px-4 py-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-border)]"
                style={{ background: ok ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' : 'var(--theme-hover)' }}>
                <HugeiconsIcon icon={PlugSocketIcon} size={14}
                  style={{ color: ok ? 'var(--theme-success)' : 'var(--theme-muted)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--theme-text)]">{ch.name}</p>
                  <StatusBadge ok={ok} label={ok ? 'Connected' : 'Not connected'} />
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{ch.note}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ch.envVars.map((v) => (
                    <code key={v} className="rounded bg-[var(--theme-hover)] px-1.5 py-0.5 text-[9px] font-mono"
                      style={{ color: ok ? 'var(--theme-muted)' : 'var(--theme-warning)' }}>
                      {v.replace('{BRAND}', brand.toUpperCase())}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3">
        <p className="text-[10px] text-[var(--theme-muted)]">
          Each variable is suffixed with the brand id (shown above for <strong>{brand.toUpperCase()}</strong>).
          Set them server-side and restart — there is no token input here by design.
        </p>
      </div>
    </section>
  )
}

type ModelOption = { id: string; name: string; cost: string }

function AiModelSection() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const prefsQuery = useQuery<{ current_model: string; available_models: ModelOption[] }>({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await fetch('/api/preferences')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ current_model: string; available_models: ModelOption[] }>
    },
    staleTime: 30_000,
  })

  const currentModel = prefsQuery.data?.current_model ?? 'openai/gpt-4o-mini'
  const models = prefsQuery.data?.available_models ?? []

  const handleChange = async (modelId: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_model: modelId }),
      })
      if (res.ok) {
        toast('AI model updated')
        await queryClient.invalidateQueries({ queryKey: ['preferences'] })
        await queryClient.invalidateQueries({ queryKey: ['chat-status'] })
      } else {
        toast('Failed to update model', { type: 'error' })
      }
    } catch {
      toast('Network error', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const costColor = (cost: string) => {
    if (cost.includes('Very')) return '#10b981'
    if (cost.includes('Moderate')) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <section className={sectionCls} style={sectionStyle}>
      <SectionHeader icon={AiBrain01Icon} title="Hermes AI Model" color="#6366f1" />
      <div className="p-4">
        <p className="mb-3 text-[11px] text-[var(--theme-muted)]">
          Choose which AI model powers Hermes. Cheaper models respond faster but may be less nuanced. Takes effect immediately.
        </p>
        <div className="space-y-2">
          {models.map(m => {
            const active = m.id === currentModel
            return (
              <button
                key={m.id}
                onClick={() => void handleChange(m.id)}
                disabled={saving || active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150',
                  active
                    ? 'border-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)]',
                )}
                style={active ? {
                  background: 'color-mix(in srgb, var(--theme-accent) 8%, var(--theme-card))',
                } : { background: 'var(--theme-card)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--theme-text)]">{m.name}</span>
                    {active && <DotBadge color="var(--theme-accent)" label="Active" />}
                  </div>
                  <code className="mt-0.5 block text-[10px] text-[var(--theme-muted)]">{m.id}</code>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: costColor(m.cost),
                    background: `color-mix(in srgb, ${costColor(m.cost)} 12%, transparent)`,
                  }}
                >
                  {m.cost}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function VoiceAvatarSection() {
  const [selectedId, setSelectedId] = useState<string>(() => {
    try { return localStorage.getItem('hermes-voice-model') ?? '' } catch { return '' }
  })
  const [saving, setSaving] = useState(false)
  const brand = useBrand()

  // Load from server on mount
  useState(() => {
    fetch('/api/voice/preference')
      .then(r => r.json())
      .then((d: { voice_model_id: string }) => {
        if (d.voice_model_id) setSelectedId(d.voice_model_id)
      })
      .catch(() => {})
  })

  const handleSelect = async (id: string) => {
    setSaving(true)
    setSelectedId(id)
    try {
      localStorage.setItem('hermes-voice-model', id)
      const res = await fetch('/api/voice/preference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_model_id: id }),
      })
      if (res.ok) {
        toast(`Voice set to ${getVoiceModel(id).name}`)
      } else {
        toast('Failed to save voice preference', { type: 'error' })
      }
    } catch {
      toast('Network error', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={sectionCls} style={sectionStyle}>
      <SectionHeader icon={AiBrain01Icon} title="Hermes Voice" color={brand.accentColor} />
      <div className="p-4">
        <p className="mb-4 text-[11px] text-[var(--theme-muted)]">
          Choose the voice avatar that Hermes speaks with. Each has a distinct personality and tone. Open-source TTS voices — no ElevenLabs required.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VOICE_MODELS.map(v => {
            const active = v.id === selectedId
            return (
              <button
                key={v.id}
                onClick={() => void handleSelect(v.id)}
                disabled={saving}
                className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all"
                style={{
                  borderColor: active ? v.color : 'var(--theme-border)',
                  background: active
                    ? `radial-gradient(ellipse at top, ${v.color}18 0%, var(--theme-card) 70%)`
                    : 'var(--theme-card)',
                  boxShadow: active ? `0 0 16px ${v.color}33` : 'none',
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                  style={{
                    background: active
                      ? `radial-gradient(circle at 38% 35%, ${v.color}, ${v.colorAlt})`
                      : `${v.color}22`,
                    boxShadow: active ? `0 0 12px ${v.color}66` : 'none',
                  }}
                >
                  {v.emoji}
                </div>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: active ? v.color : 'var(--theme-text)' }}>
                    {v.name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>{v.tagline}</p>
                </div>
                {active && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: `${v.color}22`, color: v.color }}
                  >
                    Active
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function SettingsScreen() {
  const brand = useBrand()
  const { dark, toggle: toggleTheme } = useTheme()

  const statusQuery = useQuery({
    queryKey: ['integrations-status'],
    queryFn: fetchIntegrationStatus,
    staleTime: 30_000,
  })

  const status = statusQuery.data

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+2rem)] sm:px-6">

        {/* Header */}
        <header className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Settings02Icon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[19px] font-bold leading-tight text-[var(--theme-text)]">Settings</h1>
            <p className="text-xs text-[var(--theme-muted)]">
              App preferences and integration status for <strong>{brand.name}</strong>
            </p>
          </div>
        </header>

        {/* ── Appearance ── */}
        <section className={sectionCls} style={sectionStyle}>
          <SectionHeader icon={dark ? Moon02Icon : Sun03Icon} title="Appearance" color="#8b5cf6" />
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--theme-text)]">Color theme</p>
                <p className="text-[11px] text-[var(--theme-muted)]">
                  Preference is saved to this browser. System preference is used as default.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-1">
                <button
                  onClick={() => { if (dark) toggleTheme() }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    !dark ? 'text-white' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={!dark ? { background: 'var(--theme-accent)' } : undefined}
                >
                  <HugeiconsIcon icon={Sun03Icon} size={12} />
                  Light
                </button>
                <button
                  onClick={() => { if (!dark) toggleTheme() }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    dark ? 'text-white' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={dark ? { background: 'var(--theme-accent)' } : undefined}
                >
                  <HugeiconsIcon icon={Moon02Icon} size={12} />
                  Dark
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Model ── */}
        <AiModelSection />

        {/* ── Voice Avatar ── */}
        <VoiceAvatarSection />

        {/* ── Keyboard shortcuts ── */}
        <section className={sectionCls} style={sectionStyle}>
          <SectionHeader icon={KeyboardIcon} title="Keyboard shortcuts" color="#3b82f6" />
          <div className="divide-y divide-[var(--theme-border)]">
            {[
              { keys: ['Shift', '?'], action: 'Open keyboard shortcuts' },
              { keys: ['⌘', 'K'], action: 'Open command palette' },
              { keys: ['⌘', '/'], action: 'Open command palette (alt)' },
              { keys: ['Esc'], action: 'Close modal / palette' },
              { keys: ['↑', '↓'], action: 'Navigate results' },
              { keys: ['Enter'], action: 'Select / confirm' },
            ].map(({ keys, action }) => (
              <div key={action} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[var(--theme-text)]">{action}</span>
                <div className="flex items-center gap-1">
                  {keys.map((k) => (
                    <kbd key={k} className="rounded border border-[var(--theme-border)] bg-[var(--theme-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--theme-muted)]">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integrations ── */}
        <section className={sectionCls} style={sectionStyle}>
          <SectionHeader
            icon={PlugSocketIcon}
            title="Integrations"
            color="#0ea5e9"
            right={
              <span className="ml-auto text-[10px] text-[var(--theme-muted)]">
                Configure via <code className="rounded bg-[var(--theme-hover)] px-1 font-mono">.env</code> on the server
              </span>
            }
          />

          {statusQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--theme-hover)]" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[var(--theme-border)]">
              {INTEGRATIONS.map((integration) => {
                const s = status?.[integration.key]
                const ok = s?.configured ?? false
                return (
                  <div key={integration.key} className="flex items-start gap-4 px-4 py-3.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-border)]"
                      style={{ background: ok ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' : 'var(--theme-hover)' }}>
                      <HugeiconsIcon icon={PlugSocketIcon} size={14}
                        style={{ color: ok ? 'var(--theme-success)' : 'var(--theme-muted)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[var(--theme-text)]">{integration.name}</p>
                        <StatusBadge ok={ok} label={ok ? 'Connected' : 'Not configured'} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{integration.description}</p>
                      {!ok && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {integration.envVars.map(v => (
                            <code key={v} className="rounded bg-[var(--theme-hover)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--theme-warning)]">
                              {v}
                            </code>
                          ))}
                        </div>
                      )}
                      {ok && s?.note && (
                        <p className="mt-0.5 text-[10px]" style={{ color: 'var(--theme-success)' }}>{s.note}</p>
                      )}
                    </div>
                    <a href={integration.docs} target="_blank" rel="noreferrer"
                      className="shrink-0 rounded-lg px-2 py-1 text-[10px] text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]">
                      Docs →
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {/* Webhook info */}
          <div className="border-t border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3">
            <p className="text-[11px] font-medium text-[var(--theme-text)]">Stripe webhook endpoint</p>
            <code className="mt-0.5 block text-[10px] text-[var(--theme-muted)]">
              POST https://&lt;your-domain&gt;/api/webhooks/stripe
            </code>
            <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
              Point your Stripe dashboard webhook to this URL. Handles <code>payment_intent.succeeded</code> and <code>invoice.paid</code>.
            </p>
          </div>
        </section>

        {/* ── Notifications ── */}
        <section className={sectionCls} style={sectionStyle}>
          <SectionHeader icon={Notification01Icon} title="Notification preferences" color="#f59e0b" />
          <div className="p-4">
            <p className="text-xs text-[var(--theme-muted)]">
              Manage notification preferences from the bell icon in the sidebar header.
            </p>
          </div>
        </section>

        {/* ── Push Notifications ── */}
        <PushNotificationsSection brand={brand.id} />

        {/* ── Social Channels ── */}
        <SocialChannelsSection brand={brand.id} />

        {/* ── Client Portals ── */}
        <ClientPortalsSection brand={brand.id} />

        {/* ── API Keys ── */}
        <ApiKeysSection brand={brand.id} />

        {/* ── Audit Log ── */}
        <AuditLogSection brand={brand.id} />

      </div>
    </div>
  )
}
