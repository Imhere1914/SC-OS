/**
 * Public client portal — /portal/:token
 * Token-gated, no auth header needed. Light theme always.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/portal/$token')({ component: PortalPage })

// ── Types ────────────────────────────────────────────────────────────────────

type PortalContact = {
  id: string
  name: string
  email: string | null
  company: string | null
}

type PortalProject = {
  id: string
  name: string
  status: string
  progress: number
  due_date: string | null
}

type PortalInvoice = {
  id: string
  invoice_number: string
  total: number
  status: string
  due_date?: string
}

type PortalProposal = {
  id: string
  title: string
  status: string
  sections: { type: string; content: string }[]
}

type PortalData = {
  token: {
    label: string
    show_projects: boolean
    show_invoices: boolean
    show_proposals: boolean
  }
  contact: PortalContact | null
  projects: PortalProject[]
  invoices: PortalInvoice[]
  proposals: PortalProposal[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

// ── Status badges ─────────────────────────────────────────────────────────────

const PROJECT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#dcfce7', text: '#15803d' },
  on_hold:   { bg: '#fef9c3', text: '#a16207' },
  completed: { bg: '#dbeafe', text: '#1d4ed8' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
}

const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid:     { bg: '#dcfce7', text: '#15803d' },
  sent:     { bg: '#fef9c3', text: '#a16207' },
  draft:    { bg: '#f1f5f9', text: '#475569' },
  void:     { bg: '#f1f5f9', text: '#94a3b8' },
  overdue:  { bg: '#fee2e2', text: '#b91c1c' },
  pending:  { bg: '#fef9c3', text: '#a16207' },
}

const PROPOSAL_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#f1f5f9', text: '#475569' },
  sent:     { bg: '#dbeafe', text: '#1d4ed8' },
  viewed:   { bg: '#f0fdf4', text: '#16a34a' },
  accepted: { bg: '#dcfce7', text: '#15803d' },
  declined: { bg: '#fee2e2', text: '#b91c1c' },
}

function StatusBadge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      style={{ background: colors.bg, color: colors.text }}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
    >
      {label.replace('_', ' ')}
    </span>
  )
}

function getInvoiceColors(inv: PortalInvoice) {
  // Treat sent invoices past due_date as overdue
  if (inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date()) {
    return INVOICE_STATUS_COLORS.overdue
  }
  return INVOICE_STATUS_COLORS[inv.status] ?? INVOICE_STATUS_COLORS.draft
}

function getInvoiceLabel(inv: PortalInvoice) {
  if (inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date()) {
    return 'overdue'
  }
  return inv.status
}

// ── Proposal total ───────────────────────────────────────────────────────────

function proposalTotal(p: PortalProposal): number | null {
  for (const section of p.sections) {
    if (section.type === 'pricing') {
      try {
        const data = JSON.parse(section.content) as { items?: { qty: number; unit_price: number }[] }
        if (data.items) {
          return data.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
        }
      } catch { /* ignore */ }
    }
  }
  return null
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }} className="flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-4 animate-pulse">
        <div style={{ background: '#e2e8f0', height: 28, borderRadius: 8, width: '40%' }} />
        <div style={{ background: '#e2e8f0', height: 16, borderRadius: 6, width: '60%' }} />
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
          <div style={{ background: '#e2e8f0', height: 18, borderRadius: 6, width: '35%', marginBottom: 10 }} />
          <div style={{ background: '#e2e8f0', height: 14, borderRadius: 6, width: '55%' }} />
        </div>
      </div>
    </div>
  )
}

// ── Error pages ──────────────────────────────────────────────────────────────

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }} className="flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-4">
        <div
          style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{title}</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>{message}</p>
      </div>
    </div>
  )
}

// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ projects }: { projects: PortalProject[] }) {
  if (projects.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>No projects to display.</p>
  }
  return (
    <div className="space-y-3">
      {projects.map(p => {
        const colors = PROJECT_STATUS_COLORS[p.status] ?? PROJECT_STATUS_COLORS.active
        return (
          <div
            key={p.id}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{p.name}</p>
                {p.due_date && (
                  <p style={{ fontSize: 12, color: '#64748b' }}>Due {fmtDate(p.due_date)}</p>
                )}
              </div>
              <StatusBadge label={p.status} colors={colors} />
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 10 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>{p.progress}%</span>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 9999, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    background: p.status === 'completed' ? '#16a34a' : p.status === 'cancelled' ? '#94a3b8' : '#2563eb',
                    width: `${p.progress}%`,
                    height: '100%',
                    borderRadius: 9999,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Invoices tab ──────────────────────────────────────────────────────────────

function InvoicesTab({ invoices }: { invoices: PortalInvoice[] }) {
  if (invoices.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>No invoices to display.</p>
  }
  return (
    <div className="space-y-3">
      {invoices.map(inv => {
        const colors = getInvoiceColors(inv)
        const label = getInvoiceLabel(inv)
        return (
          <div
            key={inv.id}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}
            className="flex items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{inv.invoice_number}</p>
                <StatusBadge label={label} colors={colors} />
              </div>
              {inv.due_date && (
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Due {fmtDate(inv.due_date)}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>${fmt(inv.total)}</span>
              {inv.status !== 'paid' && inv.status !== 'void' && (
                <a
                  href={`/pay/${inv.id}`}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  View / Pay
                </a>
              )}
              {inv.status === 'paid' && (
                <a
                  href={`/pay/${inv.id}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  View
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Proposals tab ─────────────────────────────────────────────────────────────

function ProposalsTab({ proposals }: { proposals: PortalProposal[] }) {
  if (proposals.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>No proposals to display.</p>
  }
  return (
    <div className="space-y-3">
      {proposals.map(p => {
        const colors = PROPOSAL_STATUS_COLORS[p.status] ?? PROPOSAL_STATUS_COLORS.draft
        const total = proposalTotal(p)
        return (
          <div
            key={p.id}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}
            className="flex items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{p.title}</p>
                <StatusBadge label={p.status} colors={colors} />
              </div>
              {total !== null && (
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Value: ${fmt(total)}</p>
              )}
            </div>
            <a
              href={`/proposal/${p.id}`}
              style={{
                border: '1px solid #2563eb',
                color: '#2563eb',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                flexShrink: 0,
              }}
            >
              View
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ── Main portal page ──────────────────────────────────────────────────────────

function PortalPage() {
  const { token } = Route.useParams()
  const [activeTab, setActiveTab] = useState<'projects' | 'invoices' | 'proposals'>('projects')

  const { data, isLoading, error, failureReason } = useQuery<PortalData>({
    queryKey: ['portal', token],
    queryFn: async () => {
      const res = await fetch(`/api/portal/${token}`)
      if (res.status === 404) throw Object.assign(new Error('not_found'), { status: 404 })
      if (res.status === 410) throw Object.assign(new Error('expired'), { status: 410 })
      if (!res.ok) throw new Error('error')
      return res.json() as Promise<PortalData>
    },
    retry: false,
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton />

  // Handle errors
  const err = error ?? failureReason
  if (err) {
    const status = (err as Error & { status?: number }).status
    if (status === 404) {
      return <ErrorPage title="Portal not found" message="This portal link is invalid or has been removed. Please contact your service provider for a new link." />
    }
    if (status === 410) {
      return <ErrorPage title="Portal link expired" message="This portal link has expired. Please contact your service provider to request a new link." />
    }
    return <ErrorPage title="Something went wrong" message="Unable to load your portal. Please try again later." />
  }

  if (!data) return null

  const { contact, projects, invoices, proposals } = data
  const portalToken = data.token

  // Build visible tabs
  type TabKey = 'projects' | 'invoices' | 'proposals'
  const tabs: { key: TabKey; label: string }[] = []
  if (portalToken.show_projects) tabs.push({ key: 'projects', label: 'Projects' })
  if (portalToken.show_invoices) tabs.push({ key: 'invoices', label: 'Invoices' })
  if (portalToken.show_proposals) tabs.push({ key: 'proposals', label: 'Proposals' })

  // Default to first visible tab
  const currentTab = tabs.find(t => t.key === activeTab)?.key ?? tabs[0]?.key ?? 'projects'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }}>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* Logo / brand header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{portalToken.label}</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Client Portal</p>
          </div>
        </div>

        {/* Contact card */}
        {contact && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dbeafe, #ede9fe)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#3b82f6',
                  flexShrink: 0,
                }}
              >
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{contact.name}</p>
                {contact.email && (
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 1 }}>{contact.email}</p>
                )}
                {contact.company && (
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{contact.company}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {tabs.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                gap: 4,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 4,
                marginBottom: 20,
              }}
            >
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: currentTab === tab.key ? 600 : 500,
                    background: currentTab === tab.key ? '#2563eb' : 'transparent',
                    color: currentTab === tab.key ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                  {tab.key === 'projects' && projects.length > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: currentTab === tab.key ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: currentTab === tab.key ? '#fff' : '#64748b',
                        borderRadius: 9999,
                        padding: '1px 7px',
                        fontSize: 11,
                      }}
                    >
                      {projects.length}
                    </span>
                  )}
                  {tab.key === 'invoices' && invoices.length > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: currentTab === tab.key ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: currentTab === tab.key ? '#fff' : '#64748b',
                        borderRadius: 9999,
                        padding: '1px 7px',
                        fontSize: 11,
                      }}
                    >
                      {invoices.length}
                    </span>
                  )}
                  {tab.key === 'proposals' && proposals.length > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: currentTab === tab.key ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: currentTab === tab.key ? '#fff' : '#64748b',
                        borderRadius: 9999,
                        padding: '1px 7px',
                        fontSize: 11,
                      }}
                    >
                      {proposals.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {currentTab === 'projects' && <ProjectsTab projects={projects} />}
            {currentTab === 'invoices' && <InvoicesTab invoices={invoices} />}
            {currentTab === 'proposals' && <ProposalsTab proposals={proposals} />}
          </>
        )}

        {tabs.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
            No content is available in this portal.
          </p>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#cbd5e1' }}>
            Powered by AI OS
          </p>
        </div>
      </div>
    </div>
  )
}
