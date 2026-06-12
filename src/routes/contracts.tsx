import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchTemplates,
  fetchContracts,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createContract,
  updateContract,
  deleteContract,
  sendContract,
  extractVariables,
  renderTemplate,
  STATUS_LABELS,
  type ContractTemplate,
  type ContractRecord,
  type ContractStatus,
  type ContractVariable,
} from '@/lib/contracts-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  SentIcon,
  Copy01Icon,
  ContractsIcon,
  FileEditIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/contracts')({ component: ContractsPage })

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const ghostBtnCls = 'flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]'

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

// Status colors: draft gray / sent blue / signed green / expired orange / cancelled red
const STATUS_DOT: Record<ContractStatus, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  signed: '#10b981',
  expired: '#f97316',
  cancelled: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const color = STATUS_DOT[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

function ModalShell({ children, maxWidth = 'max-w-2xl' }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-10 px-4 overflow-y-auto">
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl mb-12 motion-safe:animate-[fadeSlideIn_150ms_ease-out]`}
        style={{ backdropFilter: 'blur(10px)' }}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon, title, subtitle, onClose, extra }: {
  icon: typeof ContractsIcon
  title: string
  subtitle: string
  onClose: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">{title}</h2>
          <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Template modal ────────────────────────────────────────────────────────────

function TemplateModal({
  initial,
  brand,
  onClose,
  onSave,
}: {
  initial?: ContractTemplate
  brand: string
  onClose: () => void
  onSave: (data: Partial<ContractTemplate>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'General')
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html ?? '')
  const [variables, setVariables] = useState<ContractVariable[]>(initial?.variables ?? [])

  function extractVarsFromBody() {
    const keys = extractVariables(bodyHtml)
    const existing = new Map(variables.map(v => [v.key, v]))
    const merged: ContractVariable[] = keys.map(key => existing.get(key) ?? { key, label: key, default_value: '' })
    setVariables(merged)
  }

  function updateVar(idx: number, patch: Partial<ContractVariable>) {
    setVariables(v => v.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function removeVar(idx: number) {
    setVariables(v => v.filter((_, i) => i !== idx))
  }

  function addVar() {
    setVariables(v => [...v, { key: '', label: '', default_value: '' }])
  }

  return (
    <ModalShell>
      <ModalHeader
        icon={FileEditIcon}
        title={initial ? 'Edit template' : 'New template'}
        subtitle="Reusable contract body with {{variables}}"
        onClose={onClose}
      />
      <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Service Agreement"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Services, NDA, Employment"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short description"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Body HTML</label>
              <span className="text-[10px] text-[var(--theme-muted)]">Use {'{{variable_name}}'} for dynamic fields</span>
            </div>
            <textarea
              rows={10}
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              placeholder="<h1>Service Agreement</h1><p>This agreement is between {{company_name}} and {{client_name}}...</p>"
              className={`${inputCls} resize-y font-mono`}
            />
            <button
              onClick={extractVarsFromBody}
              className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--theme-border)] px-3 py-1.5 text-xs text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all duration-150"
            >
              <HugeiconsIcon icon={FileEditIcon} size={12} />
              Extract variables from body
            </button>
          </div>

          {/* Variables */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Variables <span className="tabular-nums">({variables.length})</span>
              </h3>
              <button
                onClick={addVar}
                className="flex items-center gap-1 text-xs font-medium text-[var(--theme-accent)] transition-opacity duration-150 hover:opacity-80"
              >
                <HugeiconsIcon icon={Add01Icon} size={12} /> Add
              </button>
            </div>
            {variables.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] py-3 text-center text-xs text-[var(--theme-muted)]">
                No variables — extract from body or add manually
              </p>
            ) : (
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 items-center">
                    <input
                      value={v.key}
                      onChange={e => updateVar(i, { key: e.target.value })}
                      placeholder="key"
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-xs font-mono text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
                    />
                    <input
                      value={v.label}
                      onChange={e => updateVar(i, { label: e.target.value })}
                      placeholder="Label"
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-xs text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
                    />
                    <input
                      value={v.default_value}
                      onChange={e => updateVar(i, { default_value: e.target.value })}
                      placeholder="Default"
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-xs text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
                    />
                    <button
                      onClick={() => removeVar(i)}
                      className="flex items-center justify-center rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:text-[#ef4444]"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={13} />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                  <span>Key</span><span>Label</span><span>Default</span><span />
                </div>
              </div>
            )}
          </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
          Cancel
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return
            onSave({ name, description, category, body_html: bodyHtml, variables, brand })
          }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          Save template
        </button>
      </div>
    </ModalShell>
  )
}

// ── Contract modal ────────────────────────────────────────────────────────────

function ContractModal({
  templates,
  brand,
  onClose,
  onSave,
}: {
  templates: ContractTemplate[]
  brand: string
  onClose: () => void
  onSave: (data: Partial<ContractRecord>) => void
}) {
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [contactName, setContactName] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [varData, setVarData] = useState<Record<string, string>>({})
  const [expiresAt, setExpiresAt] = useState('')

  const selectedTemplate = templates.find(t => t.id === templateId)

  function applyTemplate(tmpl: ContractTemplate) {
    setTitle(title || tmpl.name)
    setBodyHtml(tmpl.body_html)
    // Initialize variable data with defaults
    const defaults: Record<string, string> = {}
    tmpl.variables.forEach(v => { defaults[v.key] = v.default_value })
    setVarData(defaults)
  }

  function handleTemplateChange(id: string) {
    setTemplateId(id)
    if (id) {
      const tmpl = templates.find(t => t.id === id)
      if (tmpl) applyTemplate(tmpl)
    }
  }

  const renderedBody = selectedTemplate
    ? renderTemplate(bodyHtml, varData)
    : bodyHtml

  const vars = selectedTemplate?.variables ?? []

  return (
    <ModalShell>
      <ModalHeader
        icon={ContractsIcon}
        title="New contract"
        subtitle="Draft a contract for digital signing"
        onClose={onClose}
      />
      <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Template (optional)</label>
              <select
                value={templateId}
                onChange={e => handleTemplateChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— Blank contract —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Contract title"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact name</label>
              <input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Client name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Expires at</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Variable fields */}
          {vars.length > 0 && (
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Fill variables</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {vars.map(v => (
                  <div key={v.key}>
                    <label className={labelCls}>{v.label}</label>
                    <input
                      value={varData[v.key] ?? v.default_value}
                      onChange={e => setVarData(d => ({ ...d, [v.key]: e.target.value }))}
                      placeholder={v.default_value || v.key}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          {!selectedTemplate && (
            <div>
              <label className={labelCls}>Contract body (HTML)</label>
              <textarea
                rows={8}
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                placeholder="<p>Contract content...</p>"
                className={`${inputCls} resize-y font-mono`}
              />
            </div>
          )}

          {selectedTemplate && vars.length > 0 && (
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-2">Preview (rendered)</p>
              <div
                className="text-xs text-[var(--theme-text)] prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderedBody }}
              />
            </div>
          )}
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
          Cancel
        </button>
        <button
          onClick={() => {
            if (!title.trim()) return
            const finalBody = selectedTemplate ? renderTemplate(bodyHtml, varData) : bodyHtml
            onSave({
              title,
              contact_name: contactName || undefined,
              body_html: finalBody,
              template_id: templateId || undefined,
              variables_data: varData,
              brand,
              expires_at: expiresAt || undefined,
            })
          }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          Create contract
        </button>
      </div>
    </ModalShell>
  )
}

// ── Contract detail / preview modal ──────────────────────────────────────────

function ContractDetailModal({
  contract,
  onClose,
  onSend,
  onStatusChange,
}: {
  contract: ContractRecord
  onClose: () => void
  onSend: () => void
  onStatusChange: (status: ContractStatus) => void
}) {
  const shareUrl = `${location.origin}/contract/${contract.share_token}`

  function copyLink() {
    void navigator.clipboard.writeText(shareUrl)
    toast('Share link copied')
  }

  const timeline: { label: string; date?: string }[] = [
    { label: 'Created', date: contract.created_at },
    { label: 'Sent', date: contract.sent_at },
    { label: 'Signed', date: contract.signed_at },
  ].filter(t => t.date)

  const timelineColor = (label: string) =>
    label === 'Signed' ? '#10b981' : label === 'Sent' ? '#3b82f6' : '#94a3b8'

  return (
    <ModalShell maxWidth="max-w-3xl">
      <ModalHeader
        icon={ContractsIcon}
        title={contract.title}
        subtitle={contract.contact_name ? `For ${contract.contact_name}` : 'Contract detail'}
        onClose={onClose}
        extra={<StatusBadge status={contract.status} />}
      />
      <div className="p-5 space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-xs text-[var(--theme-muted)]">
            {contract.contact_name && <span>Contact: <span className="font-medium text-[var(--theme-text)]">{contract.contact_name}</span></span>}
            {contract.expires_at && <span>Expires: <span className="font-medium text-[var(--theme-text)]">{fmtDate(contract.expires_at)}</span></span>}
          </div>

          {/* Timeline — dots + connecting line */}
          {timeline.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Timeline</p>
              <div className="flex items-start">
                {timeline.map((t, i) => {
                  const color = timelineColor(t.label)
                  return (
                    <div key={i} className="flex items-start">
                      {i > 0 && (
                        <div
                          className="mt-[5px] h-px w-10 sm:w-16"
                          style={{ background: 'var(--theme-border)' }}
                        />
                      )}
                      <div className="flex flex-col items-start">
                        <span
                          className="h-[11px] w-[11px] rounded-full"
                          style={{
                            background: color,
                            boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)`,
                          }}
                        />
                        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>{t.label}</p>
                        <p className="text-xs tabular-nums text-[var(--theme-text)]">{t.date ? fmtDate(t.date) : '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Signature info */}
          {contract.signed_at && contract.signature_name && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{
                background: 'color-mix(in srgb, #10b981 10%, var(--theme-card))',
                border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: '#10b981' }}>
                <HugeiconsIcon icon={Tick02Icon} size={13} className="text-white" />
              </span>
              <p className="text-xs font-semibold" style={{ color: '#10b981' }}>
                Signed by {contract.signature_name} on {fmtDate(contract.signed_at)}
              </p>
            </div>
          )}

          {/* Share link */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Signing link</p>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2">
              <span className="flex-1 truncate text-xs font-mono text-[var(--theme-text)]">{shareUrl}</span>
              <button onClick={copyLink} title="Copy link" className={ghostBtnCls}>
                <HugeiconsIcon icon={Copy01Icon} size={12} />
                Copy
              </button>
            </div>
          </div>

          {/* Rendered body */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contract body</p>
            <div
              className="rounded-xl border border-[var(--theme-border)] bg-white p-6 text-sm text-gray-900 overflow-x-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: contract.body_html }}
            />
          </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-5 py-4">
        <div className="flex gap-2">
          {contract.status !== 'cancelled' && contract.status !== 'signed' && (
            <button
              onClick={() => onStatusChange('cancelled')}
              className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs text-[var(--theme-muted)] transition-all duration-150 hover:border-[color-mix(in_srgb,#ef4444_40%,transparent)] hover:text-[#ef4444]"
            >
              Cancel contract
            </button>
          )}
          {contract.status !== 'expired' && contract.status !== 'cancelled' && contract.status !== 'signed' && (
            <button
              onClick={() => onStatusChange('expired')}
              className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs text-[var(--theme-muted)] transition-all duration-150 hover:border-[color-mix(in_srgb,#f97316_40%,transparent)] hover:text-[#f97316]"
            >
              Mark expired
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
            Close
          </button>
          {(contract.status === 'draft') && (
            <button onClick={onSend} className={primaryBtnCls} style={primaryBtnStyle}>
              <HugeiconsIcon icon={SentIcon} size={14} />
              Send for signing
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab({
  templates,
  brand,
  onNewContract,
  refetch,
}: {
  templates: ContractTemplate[]
  brand: string
  onNewContract: (t: ContractTemplate) => void
  refetch: () => void
}) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'new' | ContractTemplate | null>(null)

  const createMut = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contract-templates', brand] })
      toast('Template created')
      setModal(null)
    },
    onError: () => toast('Failed to create template', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractTemplate> }) => updateTemplate(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contract-templates', brand] })
      toast('Template updated')
      setModal(null)
      refetch()
    },
    onError: () => toast('Failed to update template', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTemplate(id, brand),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contract-templates', brand] })
      toast('Template deleted')
      refetch()
    },
    onError: () => toast('Failed to delete template', { type: 'error' }),
  })

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            <span className="tabular-nums">{templates.length}</span> template{templates.length !== 1 ? 's' : ''}
          </p>
          <button onClick={() => setModal('new')} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={13} />
            New template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={FileEditIcon} size={26} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">No templates yet</p>
            <p className="text-xs text-[var(--theme-muted)]">Create reusable contract templates with variables</p>
            <button onClick={() => setModal('new')} className={`mt-1 ${primaryBtnCls}`} style={primaryBtnStyle}>
              New template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(t => (
              <div
                key={t.id}
                className="group rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--theme-border))]"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
                    >
                      <HugeiconsIcon icon={FileEditIcon} size={13} className="text-white" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-[var(--theme-text)]">{t.name}</p>
                      <span
                        className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{
                          background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                          color: 'var(--theme-accent)',
                          border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                        }}
                      >
                        {t.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => setModal(t)}
                      className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                    >
                      <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteMut.mutate(t.id) }}
                      className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[#ef4444]"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={13} />
                    </button>
                  </div>
                </div>
                {t.description && (
                  <p className="text-xs text-[var(--theme-muted)] mb-3 line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                    style={{
                      background: 'color-mix(in srgb, #8b5cf6 12%, var(--theme-card))',
                      color: '#8b5cf6',
                      border: '1px solid color-mix(in srgb, #8b5cf6 30%, transparent)',
                    }}
                  >
                    {t.variables.length} variable{t.variables.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => onNewContract(t)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                    style={primaryBtnStyle}
                  >
                    Use template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <TemplateModal
          initial={modal === 'new' ? undefined : modal}
          brand={brand}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal === 'new') {
              createMut.mutate(data)
            } else {
              updateMut.mutate({ id: (modal as ContractTemplate).id, data })
            }
          }}
        />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ContractsPage() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'contracts' | 'templates'>('contracts')
  const [newContractModal, setNewContractModal] = useState(false)
  const [presetTemplate, setPresetTemplate] = useState<ContractTemplate | null>(null)
  const [detailContract, setDetailContract] = useState<ContractRecord | null>(null)

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', brand.id],
    queryFn: () => fetchContracts(brand.id !== 'default' ? brand.id : undefined),
  })

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['contract-templates', brand.id],
    queryFn: () => fetchTemplates(brand.id !== 'default' ? brand.id : undefined),
  })

  const createMut = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contracts', brand.id] })
      toast('Contract created')
      setNewContractModal(false)
      setPresetTemplate(null)
    },
    onError: () => toast('Failed to create contract', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractRecord> }) => updateContract(id, data),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['contracts', brand.id] })
      setDetailContract(updated)
    },
    onError: () => toast('Failed to update contract', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteContract(id, brand.id !== 'default' ? brand.id : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contracts', brand.id] })
      toast('Contract deleted')
    },
    onError: () => toast('Failed to delete contract', { type: 'error' }),
  })

  const sendMut = useMutation({
    mutationFn: (id: string) => sendContract(id, brand.id !== 'default' ? brand.id : undefined),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['contracts', brand.id] })
      toast('Contract sent')
      setDetailContract(updated)
    },
    onError: () => toast('Failed to send contract', { type: 'error' }),
  })

  function openNewContractWithTemplate(t: ContractTemplate) {
    setPresetTemplate(t)
    setNewContractModal(true)
    setTab('contracts')
  }

  function copyShareLink(contract: ContractRecord) {
    void navigator.clipboard.writeText(`${location.origin}/contract/${contract.share_token}`)
    toast('Share link copied')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={ContractsIcon} size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Contracts</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              <span className="tabular-nums">{contracts.length}</span> contract{contracts.length !== 1 ? 's' : ''} · <span className="tabular-nums">{templates.length}</span> template{templates.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setPresetTemplate(null); setNewContractModal(true) }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={15} />
          New contract
        </button>
      </div>

      {/* Tabs — segmented control */}
      <div
        className="flex items-center border-b px-6 py-2.5"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--theme-border)] p-0.5">
          {(['contracts', 'templates'] as const).map(t => {
            const active = tab === t
            const count = t === 'contracts' ? contracts.length : templates.length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  active ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                }`}
                style={active ? {
                  background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                  color: 'var(--theme-accent)',
                } : undefined}
              >
                {t === 'contracts' ? 'Contracts' : 'Templates'}
                <span className="tabular-nums text-[10px] text-[var(--theme-muted)]">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'templates' ? (
          <TemplatesTab
            templates={templates}
            brand={brand.id}
            onNewContract={openNewContractWithTemplate}
            refetch={refetchTemplates}
          />
        ) : contractsLoading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl border border-[var(--theme-border)]"
                style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
              />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={ContractsIcon} size={26} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">No contracts yet</p>
            <p className="text-xs text-[var(--theme-muted)]">Create and send contracts for digital signing</p>
            <button
              onClick={() => { setPresetTemplate(null); setNewContractModal(true) }}
              className={`mt-1 ${primaryBtnCls}`}
              style={primaryBtnStyle}
            >
              New contract
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Title</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contact</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Sent</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Signed</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr
                  key={c.id}
                  className="group border-b transition-colors duration-150 hover:bg-[var(--theme-hover)]"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setDetailContract(c)}
                      className="text-left font-medium text-[var(--theme-text)] transition-colors duration-150 hover:text-[var(--theme-accent)]"
                    >
                      {c.title}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--theme-muted)]">
                    {c.contact_name ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 text-xs tabular-nums text-[var(--theme-muted)]">
                    {c.sent_at ? fmtDate(c.sent_at) : '—'}
                  </td>
                  <td className="px-3 py-3 text-xs tabular-nums text-[var(--theme-muted)]">
                    {c.signed_at ? (
                      <span className="font-medium" style={{ color: '#10b981' }}>{fmtDate(c.signed_at)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                      {c.status === 'draft' && (
                        <button
                          onClick={() => sendMut.mutate(c.id)}
                          title="Send for signing"
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150"
                          style={{ color: '#3b82f6' }}
                        >
                          <HugeiconsIcon icon={SentIcon} size={12} /> Send
                        </button>
                      )}
                      <button
                        onClick={() => copyShareLink(c)}
                        title="Copy share link"
                        className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-accent)]"
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={13} />
                      </button>
                      <button
                        onClick={() => setDetailContract(c)}
                        className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${c.title}"?`)) deleteMut.mutate(c.id)
                        }}
                        className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[#ef4444]"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New contract modal */}
      {newContractModal && (
        <ContractModal
          templates={templates}
          brand={brand.id}
          onClose={() => { setNewContractModal(false); setPresetTemplate(null) }}
          onSave={(data) => {
            const brandId = brand.id !== 'default' ? brand.id : 'default'
            createMut.mutate({ ...data, brand: brandId })
          }}
        />
      )}

      {/* Detail modal — initialized with preset template if applicable */}
      {presetTemplate && !newContractModal && null}

      {detailContract && (
        <ContractDetailModal
          contract={detailContract}
          onClose={() => setDetailContract(null)}
          onSend={() => sendMut.mutate(detailContract.id)}
          onStatusChange={(status) => {
            updateMut.mutate({ id: detailContract.id, data: { status, brand: brand.id } })
          }}
        />
      )}
    </div>
  )
}
