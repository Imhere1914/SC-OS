import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProposals,
  createProposal,
  updateProposal,
  deleteProposal,
  sendProposal,
  calcProposalValue,
  formatCurrency,
  STATUS_LABELS,
  type ProposalRecord,
  type ProposalSection,
  type PricingContent,
  type ProposalStatus,
} from '@/lib/proposals-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  PrinterIcon,
  SentIcon,
  CheckmarkCircle02Icon,
  Cancel02Icon,
  DocumentValidationIcon,
  PenTool01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/proposals')({ component: ProposalsPage })

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

// Status colors: draft gray / sent blue / viewed sky / accepted green / declined red
const STATUS_DOT: Record<ProposalStatus, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  viewed: '#0ea5e9',
  accepted: '#10b981',
  declined: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: ProposalStatus }) {
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

// ── Pricing table editor ──────────────────────────────────────────────────────

function PricingEditor({
  content,
  onChange,
}: {
  content: string
  onChange: (content: string) => void
}) {
  function parse(): PricingContent {
    try {
      return JSON.parse(content) as PricingContent
    } catch {
      return { items: [{ description: '', qty: 1, unit_price: 0 }], show_total: true }
    }
  }
  const data = parse()

  function update(next: PricingContent) {
    onChange(JSON.stringify(next))
  }

  function addItem() {
    update({ ...data, items: [...data.items, { description: '', qty: 1, unit_price: 0 }] })
  }

  function removeItem(i: number) {
    update({ ...data, items: data.items.filter((_, idx) => idx !== i) })
  }

  function updateItem(i: number, patch: Partial<PricingContent['items'][number]>) {
    update({ ...data, items: data.items.map((item, idx) => idx === i ? { ...item, ...patch } : item) })
  }

  const total = data.items.reduce((s, item) => s + item.qty * item.unit_price, 0)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_60px_90px_28px] gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] px-1">
        <span>Description</span><span className="text-center">Qty</span><span className="text-right">Unit Price</span><span/>
      </div>
      {data.items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_60px_90px_28px] gap-1.5 items-center">
          <input
            value={item.description}
            onChange={e => updateItem(i, { description: e.target.value })}
            placeholder="Item description"
            className={inputCls}
          />
          <input
            type="number"
            min={0}
            value={item.qty}
            onChange={e => updateItem(i, { qty: Number(e.target.value) || 0 })}
            className={`${inputCls} px-2 py-1.5 text-center tabular-nums`}
          />
          <input
            type="number"
            min={0}
            step={0.01}
            value={item.unit_price}
            onChange={e => updateItem(i, { unit_price: Number(e.target.value) || 0 })}
            className={`${inputCls} px-2 py-1.5 text-right tabular-nums`}
          />
          <button
            onClick={() => removeItem(i)}
            className="flex items-center justify-center rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:text-[#ef4444]"
          >
            <HugeiconsIcon icon={Delete02Icon} size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--theme-border)] py-1.5 text-xs text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all duration-150"
      >
        <HugeiconsIcon icon={Add01Icon} size={12} /> Add item
      </button>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-[var(--theme-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={data.show_total}
            onChange={e => update({ ...data, show_total: e.target.checked })}
            className="accent-[var(--theme-accent)]"
          />
          Show total
        </label>
        {data.show_total && (
          <span className="ml-auto text-sm font-semibold tabular-nums text-[var(--theme-text)]">
            Total: {formatCurrency(total)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section editor ────────────────────────────────────────────────────────────

function SectionEditor({
  sections,
  onChange,
}: {
  sections: ProposalSection[]
  onChange: (sections: ProposalSection[]) => void
}) {
  function addSection(type: ProposalSection['type']) {
    const newSection: ProposalSection = {
      id: crypto.randomUUID(),
      type,
      content: type === 'pricing'
        ? JSON.stringify({ items: [{ description: '', qty: 1, unit_price: 0 }], show_total: true })
        : type === 'signature'
        ? 'Accepted by: ________________________   Date: __________'
        : '',
      order: sections.length,
    }
    onChange([...sections, newSection])
  }

  function removeSection(id: string) {
    onChange(sections.filter(s => s.id !== id))
  }

  function updateSection(id: string, patch: Partial<ProposalSection>) {
    onChange(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function moveSection(id: string, dir: -1 | 1) {
    const idx = sections.findIndex(s => s.id === id)
    if (idx === -1) return
    const next = idx + dir
    if (next < 0 || next >= sections.length) return
    const arr = [...sections]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    onChange(arr.map((s, i) => ({ ...s, order: i })))
  }

  const TYPE_LABELS: Record<ProposalSection['type'], string> = {
    heading: 'Heading',
    text: 'Text block',
    pricing: 'Pricing table',
    signature: 'Signature block',
  }

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--theme-border)] py-6 text-center text-sm text-[var(--theme-muted)]">
          No sections yet — add one below
        </p>
      )}
      {sections.map((section, i) => (
        <div
          key={section.id}
          className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                color: 'var(--theme-accent)',
                border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
              }}
            >
              {TYPE_LABELS[section.type]}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                disabled={i === 0}
                onClick={() => moveSection(section.id, -1)}
                className="rounded p-0.5 text-[var(--theme-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-all duration-150"
              >
                <HugeiconsIcon icon={ArrowUp01Icon} size={13} />
              </button>
              <button
                disabled={i === sections.length - 1}
                onClick={() => moveSection(section.id, 1)}
                className="rounded p-0.5 text-[var(--theme-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-all duration-150"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} size={13} />
              </button>
              <button
                onClick={() => removeSection(section.id)}
                className="rounded p-0.5 text-[var(--theme-muted)] hover:text-[#ef4444] transition-all duration-150"
              >
                <HugeiconsIcon icon={Delete02Icon} size={13} />
              </button>
            </div>
          </div>
          {section.type === 'heading' && (
            <input
              value={section.content}
              onChange={e => updateSection(section.id, { content: e.target.value })}
              placeholder="Heading text"
              className={`${inputCls} text-base font-semibold`}
            />
          )}
          {section.type === 'text' && (
            <textarea
              rows={4}
              value={section.content}
              onChange={e => updateSection(section.id, { content: e.target.value })}
              placeholder="Enter text content…"
              className={`${inputCls} resize-y`}
            />
          )}
          {section.type === 'pricing' && (
            <PricingEditor
              content={section.content}
              onChange={content => updateSection(section.id, { content })}
            />
          )}
          {section.type === 'signature' && (
            <input
              value={section.content}
              onChange={e => updateSection(section.id, { content: e.target.value })}
              placeholder="Signature line text"
              className={inputCls}
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {(['heading', 'text', 'pricing', 'signature'] as const).map(type => (
          <button
            key={type}
            onClick={() => addSection(type)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--theme-border)] px-3 py-1.5 text-xs text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all duration-150"
          >
            <HugeiconsIcon icon={Add01Icon} size={12} />
            {type === 'heading' ? 'Heading' : type === 'text' ? 'Text block' : type === 'pricing' ? 'Pricing table' : 'Signature'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Proposal Preview ──────────────────────────────────────────────────────────

function ProposalPreview({ proposal }: { proposal: { title: string; contact_name?: string; sections: ProposalSection[]; valid_until?: string; notes?: string } }) {
  return (
    <div className="proposal-preview bg-white text-gray-900 p-10 min-h-screen">
      <style>{`
        @media print {
          body > * { display: none !important; }
          .proposal-preview { display: block !important; }
        }
      `}</style>
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{proposal.title}</h1>
        {proposal.contact_name && (
          <p className="text-gray-500 mb-1">Prepared for: <span className="text-gray-700 font-medium">{proposal.contact_name}</span></p>
        )}
        {proposal.valid_until && (
          <p className="text-sm text-gray-400 mb-6">Valid until: {fmtDate(proposal.valid_until)}</p>
        )}
        <hr className="my-6 border-gray-200" />
        {proposal.sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(section => (
            <div key={section.id} className="mb-6">
              {section.type === 'heading' && (
                <h2 className="text-xl font-bold text-gray-800 mt-8 mb-2">{section.content}</h2>
              )}
              {section.type === 'text' && (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{section.content}</p>
              )}
              {section.type === 'pricing' && (() => {
                try {
                  const data = JSON.parse(section.content) as PricingContent
                  const total = data.items.reduce((s, item) => s + item.qty * item.unit_price, 0)
                  return (
                    <table className="w-full border-collapse text-sm mt-2">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                          <th className="text-center py-2 text-gray-500 font-medium w-16">Qty</th>
                          <th className="text-right py-2 text-gray-500 font-medium w-24">Unit Price</th>
                          <th className="text-right py-2 text-gray-500 font-medium w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 text-gray-700">{item.description}</td>
                            <td className="py-2 text-center text-gray-600">{item.qty}</td>
                            <td className="py-2 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(item.qty * item.unit_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {data.show_total && (
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="pt-3 text-right font-bold text-gray-800">Total</td>
                            <td className="pt-3 text-right font-bold text-lg text-gray-900">{formatCurrency(total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )
                } catch { return null }
              })()}
              {section.type === 'signature' && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-sm text-gray-600">{section.content}</p>
                </div>
              )}
            </div>
          ))}
        {proposal.notes && (
          <div className="mt-8 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Proposal modal (create/edit) ──────────────────────────────────────────────

function ProposalModal({
  initial,
  brand,
  onClose,
  onSave,
}: {
  initial?: ProposalRecord
  brand?: string
  onClose: () => void
  onSave: (data: Partial<ProposalRecord>) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ? initial.valid_until.split('T')[0] : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [sections, setSections] = useState<ProposalSection[]>(initial?.sections ?? [])
  const [signingRequired, setSigningRequired] = useState(initial?.signing_required ?? false)
  const [showPreview, setShowPreview] = useState(false)

  if (showPreview) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur px-6 py-3 border-b border-gray-200 print:hidden">
          <span className="text-sm font-semibold text-gray-700">Proposal Preview</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <HugeiconsIcon icon={PrinterIcon} size={14} /> Print
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Back to editor
            </button>
          </div>
        </div>
        <ProposalPreview proposal={{ title, contact_name: contactName || undefined, sections, valid_until: validUntil || undefined, notes: notes || undefined }} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-10 px-4 overflow-y-auto">
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl mb-12 motion-safe:animate-[fadeSlideIn_150ms_ease-out]"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={DocumentValidationIcon} size={15} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">
                {initial ? 'Edit proposal' : 'New proposal'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Compose sections, pricing and signing terms</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
            >
              <HugeiconsIcon icon={PrinterIcon} size={13} /> Preview
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Proposal title"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact name</label>
              <input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="John Smith"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="john@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Valid until</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={signingRequired}
                  onChange={e => setSigningRequired(e.target.checked)}
                  className="accent-[var(--theme-accent)] h-4 w-4"
                />
                <span className="text-sm text-[var(--theme-text)]">Require client signature</span>
                <HugeiconsIcon icon={PenTool01Icon} size={14} className="text-[var(--theme-muted)]" />
              </label>
              <p className="mt-0.5 ml-6 text-[11px] text-[var(--theme-muted)]">
                Client must draw or type a signature on the public proposal page to accept.
              </p>
            </div>
          </div>

          {/* Section builder */}
          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Sections</h3>
            <SectionEditor sections={sections} onChange={setSections} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return
              onSave({
                title,
                contact_name: contactName || undefined,
                contact_email: contactEmail || undefined,
                valid_until: validUntil || undefined,
                notes: notes || undefined,
                sections,
                brand,
                signing_required: signingRequired,
              })
            }}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ProposalsPage() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [modal, setModal] = useState<'new' | ProposalRecord | null>(null)
  const [previewProposal, setPreviewProposal] = useState<ProposalRecord | null>(null)

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', brand.id],
    queryFn: () => fetchProposals(brand.id !== 'default' ? { brand: brand.id } : {}),
  })

  const createMut = useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals', brand.id] })
      toast('Proposal created')
      setModal(null)
    },
    onError: () => toast('Failed to create proposal'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProposalRecord> }) =>
      updateProposal(id, updates),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals', brand.id] })
      toast('Proposal updated')
      setModal(null)
    },
    onError: () => toast('Failed to update proposal'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals', brand.id] })
      toast('Proposal deleted')
    },
    onError: () => toast('Failed to delete proposal'),
  })

  const sendMut = useMutation({
    mutationFn: (id: string) => sendProposal(id, brand.id !== 'default' ? brand.id : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals', brand.id] })
      toast('Proposal marked as sent')
    },
    onError: (err: Error) => toast(err.message || 'Failed to send proposal'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProposalStatus }) =>
      updateProposal(id, { status }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['proposals', brand.id] })
      toast(`Proposal ${vars.status}`)
    },
    onError: () => toast('Failed to update status'),
  })

  if (previewProposal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur px-6 py-3 border-b border-gray-200 print:hidden">
          <span className="text-sm font-semibold text-gray-700">{previewProposal.title}</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <HugeiconsIcon icon={PrinterIcon} size={14} /> Print
            </button>
            <button
              onClick={() => setPreviewProposal(null)}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
        <ProposalPreview proposal={previewProposal} />
      </div>
    )
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
            <HugeiconsIcon icon={DocumentValidationIcon} size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Proposals</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              <span className="tabular-nums">{proposals.length}</span> proposal{proposals.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setModal('new')} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={15} />
          New proposal
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl border border-[var(--theme-border)]"
                style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
              />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={DocumentValidationIcon} size={26} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">No proposals yet</p>
            <p className="text-xs text-[var(--theme-muted)]">Create your first proposal to get started</p>
            <button onClick={() => setModal('new')} className={`mt-1 ${primaryBtnCls}`} style={primaryBtnStyle}>
              New proposal
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Title</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contact</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Value</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Created</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => {
                const value = calcProposalValue(p.sections)
                return (
                  <tr
                    key={p.id}
                    className="group border-b transition-colors duration-150 hover:bg-[var(--theme-hover)]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setPreviewProposal(p)}
                        className="text-left font-medium text-[var(--theme-text)] transition-colors duration-150 hover:text-[var(--theme-accent)]"
                      >
                        {p.title}
                      </button>
                      {p.valid_until && (
                        <p className="text-[10px] text-[var(--theme-muted)]">Valid until {fmtDate(p.valid_until)}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {p.contact_name ? (
                        <div>
                          <p className="text-[var(--theme-text)]">{p.contact_name}</p>
                          {p.contact_email && <p className="text-[10px] text-[var(--theme-muted)]">{p.contact_email}</p>}
                        </div>
                      ) : (
                        <span className="text-[var(--theme-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        {p.signing_required && p.signed_at ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                              color: '#10b981',
                              border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
                            }}
                          >
                            <HugeiconsIcon icon={Tick02Icon} size={10} />
                            Signed{p.signature_name ? ` by ${p.signature_name}` : ''}
                          </span>
                        ) : p.signing_required && !p.signed_at ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
                              color: '#f59e0b',
                              border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
                            }}
                          >
                            <HugeiconsIcon icon={PenTool01Icon} size={10} /> Sig. required
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-[15px] font-bold tabular-nums text-[var(--theme-text)]">
                        {value > 0 ? formatCurrency(value) : <span className="text-sm font-normal text-[var(--theme-muted)]">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-[var(--theme-muted)]">
                      {fmtDate(p.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                        {/* Status actions */}
                        {p.status === 'draft' && (
                          <button
                            onClick={() => sendMut.mutate(p.id)}
                            title="Mark as sent"
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150"
                            style={{ color: '#3b82f6' }}
                          >
                            <HugeiconsIcon icon={SentIcon} size={12} /> Send
                          </button>
                        )}
                        {(p.status === 'sent' || p.status === 'viewed') && (
                          <>
                            <button
                              onClick={() => statusMut.mutate({ id: p.id, status: 'accepted' })}
                              title="Accept"
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150"
                              style={{ color: '#10b981' }}
                            >
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} /> Accept
                            </button>
                            <button
                              onClick={() => statusMut.mutate({ id: p.id, status: 'declined' })}
                              title="Decline"
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150"
                              style={{ color: '#ef4444' }}
                            >
                              <HugeiconsIcon icon={Cancel02Icon} size={12} /> Decline
                            </button>
                          </>
                        )}
                        {/* Public link */}
                        <a
                          href={`/proposal/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Public view"
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-accent)]"
                        >
                          <HugeiconsIcon icon={PrinterIcon} size={13} />
                        </a>
                        {/* Edit */}
                        <button
                          onClick={() => setModal(p)}
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${p.title}"?`)) deleteMut.mutate(p.id)
                          }}
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[#ef4444]"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ProposalModal
          initial={modal === 'new' ? undefined : modal}
          brand={brand.id !== 'default' ? brand.id : undefined}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal === 'new') {
              createMut.mutate(data as Parameters<typeof createProposal>[0])
            } else {
              updateMut.mutate({ id: (modal as ProposalRecord).id, updates: data })
            }
          }}
        />
      )}
    </div>
  )
}
