import { useMemo, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import {
  Add01Icon,
  Activity01Icon,
  AlertCircleIcon,
  Building01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Delete01Icon,
  Download01Icon,
  Mail01Icon,
  MultiplicationSignIcon,
  RefreshIcon,
  Search01Icon,
  SmartPhone01Icon,
  Tag01Icon,
  Target01Icon,
  Upload01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserMinus01Icon,
  ViewIcon,
  ListViewIcon,
  Analytics01Icon,
} from '@hugeicons/core-free-icons'
import { computeLeadScore } from '@/lib/lead-score'

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const ghostBtnCls = 'flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]'

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[12px]',
      )}
      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
    >
      {initials || '?'}
    </div>
  )
}

// Stage as colored dot + soft tinted badge
export function StageBadge({ stage }: { stage: ContactStage }) {
  const color = STAGE_HEX[stage]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STAGE_LABELS[stage]}
    </span>
  )
}

// Small tinted tag chip
function TagChip({ tag, small }: { tag: string; small?: boolean }) {
  return (
    <span
      className={cn('rounded-md font-medium', small ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[9px]')}
      style={{
        background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
        color: 'var(--theme-accent)',
        border: '1px solid color-mix(in srgb, var(--theme-accent) 22%, transparent)',
      }}
    >
      {tag}
    </span>
  )
}

// Gradient-accented stat card
export function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof UserGroupIcon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 truncate text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// ── Duplicate scanner ──────────────────────────────────────────────────────

type DupeGroup = { key: string; reason: string; contacts: Contact[] }

function findDuplicates(contacts: Contact[]): DupeGroup[] {
  const emailMap: Record<string, Contact[]> = {}
  const phoneMap: Record<string, Contact[]> = {}

  for (const c of contacts) {
    if (c.email) {
      const k = c.email.toLowerCase().trim()
      if (k) { emailMap[k] = emailMap[k] ?? []; emailMap[k].push(c) }
    }
    if (c.phone) {
      const k = c.phone.replace(/\D/g, '')
      if (k.length >= 7) { phoneMap[k] = phoneMap[k] ?? []; phoneMap[k].push(c) }
    }
  }

  const groups: DupeGroup[] = []
  for (const [email, cs] of Object.entries(emailMap)) {
    if (cs.length > 1) groups.push({ key: `email:${email}`, reason: `Same email: ${email}`, contacts: cs })
  }
  for (const [phone, cs] of Object.entries(phoneMap)) {
    if (cs.length > 1) groups.push({ key: `phone:${phone}`, reason: `Same phone: ${phone}`, contacts: cs })
  }
  return groups
}

function DuplicateScannerModal({
  contacts,
  onDelete,
  onMerge,
  onClose,
}: {
  contacts: Contact[]
  onDelete: (id: string) => void
  onMerge: (keepId: string, deleteId: string) => Promise<void>
  onClose: () => void
}) {
  const [merging, setMerging] = useState<string | null>(null)
  const groups = findDuplicates(contacts)

  const handleMerge = async (keepId: string, deleteId: string, deleteName: string) => {
    if (!confirm(`Merge "${deleteName}" into the primary contact? Non-empty fields, tags, and notes will be combined.`)) return
    setMerging(deleteId)
    try {
      await onMerge(keepId, deleteId)
      onClose()
    } finally {
      setMerging(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Copy01Icon} size={16} className="text-white" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--theme-text)]">Duplicate Contacts</h3>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {groups.length === 0 ? 'No duplicates found' : `${groups.length} group${groups.length > 1 ? 's' : ''} found`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={28} className="mb-2 text-[var(--theme-success)]" />
              <p className="text-sm font-medium">No duplicates detected</p>
              <p className="mt-1 text-xs">All contacts have unique emails and phone numbers.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--theme-border)]">
              {groups.map(group => (
                <div key={group.key} className="px-5 py-3">
                  <p className="mb-2 text-[11px] font-semibold text-[var(--theme-accent)]">{group.reason}</p>
                  <div className="space-y-1.5">
                    {group.contacts.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border border-[var(--theme-border)] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[var(--theme-text)]">{c.name}</p>
                          <p className="text-[10px] text-[var(--theme-muted)]">
                            {c.email}{c.phone && ` · ${c.phone}`} · {c.stage}
                            {c.tags.length > 0 && ` · ${c.tags.join(', ')}`}
                          </p>
                        </div>
                        {i === 0 ? (
                          <span className="shrink-0 rounded-full bg-[var(--theme-accent-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--theme-accent)]">
                            Primary
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              disabled={merging === c.id}
                              onClick={() => void handleMerge(group.contacts[0].id, c.id, c.name)}
                              className="rounded-lg border border-[var(--theme-accent)] px-2 py-1 text-[10px] font-semibold text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)] disabled:opacity-50"
                            >
                              {merging === c.id ? '…' : 'Merge'}
                            </button>
                            <button
                              onClick={() => { if (confirm(`Delete "${c.name}"?`)) { onDelete(c.id) } }}
                              className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--theme-border)] px-5 py-3">
          <p className="text-[10px] text-[var(--theme-muted)]">
            <strong>Merge</strong> combines all fields, tags, and notes into the primary contact. <strong>Delete</strong> removes without merging.
          </p>
        </div>
      </div>
    </div>
  )
}
import { CsvImportDialog } from '@/components/CsvImportDialog'
import {
  CONTACT_STAGES,
  STAGE_LABELS,
  createContact,
  deleteContact,
  fetchContacts,
  updateContact,
  mergeContacts,
} from '@/lib/contacts-api'
import type { Contact, ContactStage, CreateContactInput } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['contacts'] as const
const STAGE_HEX: Record<ContactStage, string> = {
  lead: '#94a3b8',
  contacted: '#3b82f6',
  qualified: '#f59e0b',
  customer: '#10b981',
  lost: '#ef4444',
}

type FormState = {
  name: string; email: string; phone: string; company: string; stage: ContactStage; notes: string; tags: string
}
const EMPTY_FORM: FormState = { name: '', email: '', phone: '', company: '', stage: 'lead', notes: '', tags: '' }

function ContactDialog({ open, initial, onClose, onSubmit, isSubmitting, title }: {
  open: boolean; initial: FormState; onClose: () => void; onSubmit: (f: FormState) => void; isSubmitting: boolean; title: string
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => { if (open) setForm(initial) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={UserAdd01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">Name, contact details, pipeline stage and tags</p>
          </div>
        </div>
        <div className="p-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Details</p>
        <div className="space-y-3">
          {([['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['company', 'Company', 'text'], ['tags', 'Tags (comma-separated)', 'text']] as Array<[keyof FormState, string, string]>).map(([key, label, type]) => (
            <div key={key}>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">{label}</label>
              <input type={type} value={form[key]} onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]" />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Stage</label>
            <select value={form.stage} onChange={(e) => set('stage', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]">
              {CONTACT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={!form.name.trim() || isSubmitting}
            className={primaryBtnCls} style={primaryBtnStyle}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban column card ────────────────────────────────────────────────────────
function KanbanCard({ c, onDelete, onDragStart }: {
  c: Contact
  onDelete: (id: string) => void
  onDragStart: (id: string) => void
}) {
  return (
    <Link
      to="/contacts/$id"
      params={{ id: c.id }}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(c.id) }}
      className="group block cursor-grab rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={c.name} size="sm" />
          <p className="truncate text-xs font-semibold leading-snug text-[var(--theme-text)]">{c.name}</p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete ${c.name}?`)) onDelete(c.id) }}
          className="shrink-0 rounded-md p-0.5 opacity-0 transition-opacity hover:bg-[var(--theme-hover)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          title="Delete"
        >
          <HugeiconsIcon icon={Delete01Icon} size={11} style={{ color: 'var(--theme-danger)' }} />
        </button>
      </div>
      {c.company && <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={Building01Icon} size={9} />{c.company}</p>}
      {c.email && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={Mail01Icon} size={9} />{c.email}</p>}
      {c.phone && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={SmartPhone01Icon} size={9} />{c.phone}</p>}
      {c.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {c.tags.slice(0, 3).map(t => <TagChip key={t} tag={t} small />)}
        </div>
      )}
    </Link>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────
function KanbanView({ contacts, onDelete, onMoveStage }: {
  contacts: Contact[]
  onDelete: (id: string) => void
  onMoveStage: (id: string, stage: ContactStage) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<ContactStage | null>(null)

  const handleDrop = (stage: ContactStage) => {
    if (draggingId) {
      const contact = contacts.find(c => c.id === draggingId)
      if (contact && contact.stage !== stage) onMoveStage(draggingId, stage)
    }
    setDraggingId(null)
    setOverStage(null)
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 pb-3" style={{ minWidth: 900 }}>
        {CONTACT_STAGES.map(stage => {
          const cols = contacts.filter(c => c.stage === stage)
          const isOver = overStage === stage
          return (
            <div
              key={stage}
              onDragOver={e => { e.preventDefault(); setOverStage(stage) }}
              onDragLeave={() => setOverStage(null)}
              onDrop={() => handleDrop(stage)}
              className="flex w-52 shrink-0 flex-col overflow-hidden rounded-2xl border transition-all duration-150"
              style={{
                background: `color-mix(in srgb, ${STAGE_HEX[stage]} 5%, var(--theme-card))`,
                borderColor: isOver ? STAGE_HEX[stage] : 'var(--theme-border)',
                boxShadow: isOver ? `0 0 0 2px color-mix(in srgb, ${STAGE_HEX[stage]} 20%, transparent)` : undefined,
              }}
            >
              <div
                className="flex items-center gap-2 border-b px-3 py-2.5"
                style={{
                  background: `color-mix(in srgb, ${STAGE_HEX[stage]} 12%, var(--theme-card))`,
                  borderColor: `color-mix(in srgb, ${STAGE_HEX[stage]} 25%, var(--theme-border))`,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: STAGE_HEX[stage] }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: STAGE_HEX[stage] }}>{STAGE_LABELS[stage]}</span>
                <span className="ml-auto rounded-full bg-[var(--theme-card)] px-1.5 py-px text-[9px] font-bold tabular-nums text-[var(--theme-muted)]">{cols.length}</span>
              </div>
              <div className="flex min-h-[60px] flex-col gap-2 p-2.5">
                {cols.length === 0 ? (
                  <p className="py-4 text-center text-[10px] text-[var(--theme-muted)] opacity-50">
                    {isOver ? 'Drop here' : 'Empty'}
                  </p>
                ) : (
                  cols.map(c => (
                    <div key={c.id} style={{ opacity: draggingId === c.id ? 0.4 : 1 }}>
                      <KanbanCard c={c} onDelete={onDelete} onDragStart={setDraggingId} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Health score types ────────────────────────────────────────────────────────
interface ContactHealth {
  contact_id: string
  contact_name: string
  brand: string
  score: number
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

const TIER_COLOR: Record<ContactHealth['tier'], string> = {
  healthy:  '#22c55e',
  neutral:  '#eab308',
  at_risk:  '#f97316',
  critical: '#ef4444',
}
const TIER_LABEL: Record<ContactHealth['tier'], string> = {
  healthy:  'Healthy',
  neutral:  'Neutral',
  at_risk:  'At Risk',
  critical: 'Critical',
}

function ScoreRing({ score, tier }: { score: number; tier: ContactHealth['tier'] }) {
  const color = TIER_COLOR[tier]
  const pct = Math.round(score)
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[var(--theme-text)]"
      style={{
        background: `conic-gradient(${color} 0% ${pct}%, var(--theme-border) ${pct}% 100%)`,
        padding: 3,
      }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--theme-card)]">
        {pct}
      </div>
    </div>
  )
}

function HealthView({ brand }: { brand: { id: string } }) {
  const qc = useQueryClient()
  const [tierFilter, setTierFilter] = useState<ContactHealth['tier'] | 'all'>('all')

  const healthQuery = useQuery<ContactHealth[]>({
    queryKey: ['contacts', 'health', brand.id],
    queryFn: async () => {
      const res = await fetch('/api/contacts/health', { headers: { 'x-brand': brand.id } })
      if (!res.ok) throw new Error('Failed to load health scores')
      return res.json() as Promise<ContactHealth[]>
    },
  })

  const TIERS: Array<ContactHealth['tier'] | 'all'> = ['all', 'critical', 'at_risk', 'neutral', 'healthy']

  const sorted = useMemo(() => {
    const list = healthQuery.data ?? []
    const filtered = tierFilter === 'all' ? list : list.filter(h => h.tier === tierFilter)
    return [...filtered].sort((a, b) => a.score - b.score)
  }, [healthQuery.data, tierFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, healthy: 0, neutral: 0, at_risk: 0, critical: 0 }
    for (const h of healthQuery.data ?? []) { c.all++; c[h.tier] = (c[h.tier] ?? 0) + 1 }
    return c
  }, [healthQuery.data])

  return (
    <div className="mt-4">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {TIERS.map(t => {
            const color = t === 'all' ? 'var(--theme-accent)' : TIER_COLOR[t]
            const active = tierFilter === t
            return (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150',
                  active ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                )}
                style={active ? {
                  background: `color-mix(in srgb, ${color} 14%, var(--theme-card))`,
                  color,
                } : undefined}
              >
                {t === 'all' ? 'All' : TIER_LABEL[t]}
                <span className="ml-1 opacity-60 tabular-nums">{counts[t] ?? 0}</span>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => void qc.invalidateQueries({ queryKey: ['contacts', 'health', brand.id] })}
          className={ghostBtnCls}
        >
          <HugeiconsIcon icon={RefreshIcon} size={13} /> Refresh Scores
        </button>
      </div>

      {/* Grid */}
      {healthQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-pulse">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-48 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : healthQuery.isError ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={AlertCircleIcon} size={22} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">Could not load health scores</p>
          <p className="text-[11px] text-[var(--theme-muted)]">Check your connection and try again.</p>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['contacts', 'health', brand.id] })}
            className={cn(primaryBtnCls, 'mt-2')}
            style={primaryBtnStyle}
          >
            Retry
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Activity01Icon} size={22} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">No contacts match this filter</p>
          <p className="text-[11px] text-[var(--theme-muted)]">Try a different health tier.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map(h => {
            const color = TIER_COLOR[h.tier]
            return (
              <Link
                key={h.contact_id}
                to="/contacts/$id"
                params={{ id: h.contact_id }}
                className="flex flex-col gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                {/* Top row: avatar + ring */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={h.contact_name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--theme-text)]">{h.contact_name}</p>
                      {/* company pulled from factors; we only have the health record so we skip it */}
                    </div>
                  </div>
                  <ScoreRing score={h.score} tier={h.tier} />
                </div>

                {/* Tier badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
                      color,
                      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    {TIER_LABEL[h.tier]}
                  </span>
                  {h.last_activity_days != null && (
                    <span className="text-[10px] text-[var(--theme-muted)]">
                      {h.last_activity_days}d since activity
                    </span>
                  )}
                </div>

                {/* Factor bars */}
                <div className="space-y-1">
                  {(
                    [
                      ['Recency', h.factors.recency, 30],
                      ['Invoices', h.factors.invoice_payment, 25],
                      ['Deals', h.factors.deal_activity, 20],
                      ['Engagement', h.factors.engagement, 15],
                      ['Lead score', h.factors.lead_score, 10],
                    ] as [string, number, number][]
                  ).map(([label, val, max]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-[68px] shrink-0 text-[9px] text-[var(--theme-muted)]">{label}</span>
                      <div className="relative h-1.5 flex-1 rounded-full bg-[var(--theme-border)]">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{ width: `${(val / max) * 100}%`, background: color }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[9px] font-medium text-[var(--theme-muted)]">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Meta tags */}
                {(h.open_deals > 0 || h.unpaid_invoices > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {h.open_deals > 0 && (
                      <span className="rounded border border-[#22c55e33] bg-[#22c55e10] px-1.5 py-px text-[9px] font-medium text-[#22c55e]">
                        {h.open_deals} open deal{h.open_deals > 1 ? 's' : ''}
                      </span>
                    )}
                    {h.unpaid_invoices > 0 && (
                      <span className="rounded border border-[#ef444433] bg-[#ef444410] px-1.5 py-px text-[9px] font-medium text-[#ef4444]">
                        {h.unpaid_invoices} unpaid
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function ContactsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const term = brand.id === 'hfm' ? 'Patients' : 'Contacts'
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<ContactStage | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'health'>('list')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState<ContactStage | ''>('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [showTagCloud, setShowTagCloud] = useState(false)
  const [showDupeScanner, setShowDupeScanner] = useState(false)

  const contactsQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => fetchContacts() })
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  // Build tag cloud: { tag -> count } sorted by count desc
  const tagCloud = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of contactsQuery.data ?? []) {
      for (const t of c.tags) counts[t] = (counts[t] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [contactsQuery.data])

  const createMutation = useMutation({
    mutationFn: (i: CreateContactInput) => createContact(i),
    onSuccess: () => { invalidate(); toast('Contact created'); setShowCreate(false) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed', { type: 'error' }),
  })
  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: CreateContactInput }) => updateContact(p.id, p.updates),
    onSuccess: () => { invalidate(); toast('Contact updated'); setEditing(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed', { type: 'error' }),
  })
  const deleteMutation = useMutation({ mutationFn: (id: string) => deleteContact(id), onSuccess: () => { invalidate(); toast('Deleted') } })
  const mergeMutation = useCallback(async (keepId: string, deleteId: string) => {
    await mergeContacts(keepId, deleteId)
    invalidate()
    toast('Contacts merged')
  }, [queryClient])

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await deleteContact(id) },
    onSuccess: () => { invalidate(); setSelected(new Set()); toast('Deleted') },
  })
  const bulkStageMutation = useMutation({
    mutationFn: async ({ ids, stage }: { ids: string[]; stage: ContactStage }) => {
      for (const id of ids) await updateContact(id, { stage })
    },
    onSuccess: () => { invalidate(); setSelected(new Set()); toast('Stage updated') },
  })
  const kanbanMoveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ContactStage }) => updateContact(id, { stage }),
    onSuccess: (_, { stage }) => { invalidate(); toast(`Moved to ${STAGE_LABELS[stage]}`) },
    onError: () => toast('Move failed', { type: 'error' }),
  })

  function toggleSelect(id: string) {
    setSelected(s => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.id)))
  }

  const filtered = useMemo(() => {
    let list = contactsQuery.data ?? []
    if (stageFilter !== 'all') list = list.filter((c) => c.stage === stageFilter)
    if (tagFilter) list = list.filter((c) => c.tags.includes(tagFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q))
    }
    return list
  }, [contactsQuery.data, stageFilter, tagFilter, search])

  // Display-only stats derived from the already-fetched list
  const stats = useMemo(() => {
    const list = contactsQuery.data ?? []
    const by = (s: ContactStage) => list.filter(c => c.stage === s).length
    return {
      total: list.length,
      pipeline: by('lead') + by('contacted') + by('qualified'),
      customers: by('customer'),
      lost: by('lost'),
    }
  }, [contactsQuery.data])

  const toForm = (c: Contact): FormState => ({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', company: c.company ?? '', stage: c.stage, notes: c.notes, tags: c.tags.join(', ') })
  const fromForm = (f: FormState): CreateContactInput => ({
    name: f.name.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, company: f.company.trim() || null,
    stage: f.stage, notes: f.notes, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  })

  const exportCsv = () => {
    const cols = ['name','email','phone','company','stage','tags','source','notes','created_at']
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
    const rows = [cols.join(',')]
    for (const c of filtered) {
      rows.push([
        escape(c.name),
        escape(c.email ?? ''),
        escape(c.phone ?? ''),
        escape(c.company ?? ''),
        escape(c.stage),
        escape(c.tags.join('; ')),
        escape(c.source),
        escape((c.notes ?? '').replace(/\n/g, ' ')),
        escape(c.created_at?.slice(0, 10) ?? ''),
      ].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `contacts-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast(`Exported ${filtered.length} contacts`)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1060px] flex-col px-6 py-7">

      {/* ── Page header ── */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">{term}</h1>
            <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
              {contactsQuery.data
                ? `${stats.total} contacts · ${stats.pipeline} pipeline · ${stats.customers} customers`
                : 'Your CRM backbone'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={invalidate}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
            title="Refresh"
          >
            <HugeiconsIcon icon={RefreshIcon} size={15} />
          </button>
          <button onClick={() => setShowImport(true)} className={ghostBtnCls} title="Import from CSV">
            <HugeiconsIcon icon={Upload01Icon} size={13} /> Import
          </button>
          <button onClick={exportCsv} className={ghostBtnCls} title={`Export ${filtered.length} contacts to CSV`}>
            <HugeiconsIcon icon={Download01Icon} size={13} /> Export
          </button>
          <button onClick={() => setShowDupeScanner(true)} className={ghostBtnCls} title="Find duplicate contacts">
            <HugeiconsIcon icon={MultiplicationSignIcon} size={13} /> Dupes
          </button>
          {tagCloud.length > 0 && (
            <button
              onClick={() => setShowTagCloud(s => !s)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                showTagCloud || tagFilter
                  ? 'border-transparent'
                  : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]',
              )}
              style={showTagCloud || tagFilter ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
                border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
              } : undefined}
              title="Filter by tag"
            >
              <HugeiconsIcon icon={Tag01Icon} size={13} />
              Tags{tagFilter ? `: ${tagFilter}` : ''}
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} /> New {term === 'Patients' ? 'Patient' : 'Contact'}
          </button>
        </div>
      </header>

      {/* ── Stat cards ── */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`Total ${term}`} value={String(stats.total)} sub="in your CRM" color="#3b82f6" icon={UserGroupIcon} />
        <StatCard label="In Pipeline" value={String(stats.pipeline)} sub="lead → qualified" color="#f59e0b" icon={Target01Icon} />
        <StatCard label="Customers" value={String(stats.customers)} sub="converted" color="#10b981" icon={UserCheck01Icon} />
        <StatCard label="Lost" value={String(stats.lost)} sub="closed out" color="#ef4444" icon={UserMinus01Icon} />
      </div>

      {/* ── View-mode segmented control ── */}
      <div className="mb-3 flex w-fit max-w-[calc(100%-80px)] gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1 md:max-w-none">
        {([['list', ListViewIcon, 'List'], ['kanban', ViewIcon, 'Kanban'], ['health', Activity01Icon, 'Health']] as const).map(([mode, icon, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150',
              viewMode === mode ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
            )}
            style={viewMode === mode ? {
              background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
              color: 'var(--theme-accent)',
            } : undefined}
            title={`${label} view`}
          >
            <HugeiconsIcon icon={icon} size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── Search + stage filters (glass) ── */}
      <div
        className="rounded-2xl border border-[var(--theme-border)] p-4"
        style={{ background: 'color-mix(in srgb, var(--theme-card) 70%, transparent)', backdropFilter: 'blur(10px)' }}
      >
        <div className={cn('relative', viewMode === 'list' && 'mb-3')}>
          <HugeiconsIcon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
          <input type="text" placeholder={`Search ${term.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] py-1.5 pl-8 pr-3 text-xs text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            style={{ background: 'color-mix(in srgb, var(--theme-input) 75%, transparent)', backdropFilter: 'blur(10px)' }} />
        </div>
        {viewMode === 'list' && (
          <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
            {(['all', ...CONTACT_STAGES] as const).map((s) => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={cn('rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150',
                  stageFilter === s ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                style={stageFilter === s ? {
                  background: `color-mix(in srgb, ${s === 'all' ? 'var(--theme-accent)' : STAGE_HEX[s]} 14%, var(--theme-card))`,
                  color: s === 'all' ? 'var(--theme-accent)' : STAGE_HEX[s],
                } : undefined}>
                {s === 'all' ? 'All' : STAGE_LABELS[s]}
                <span className="ml-1 opacity-60 tabular-nums">
                  {s === 'all' ? (contactsQuery.data?.length ?? 0) : (contactsQuery.data ?? []).filter(c => c.stage === s).length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tag cloud panel ── */}
      {showTagCloud && tagCloud.length > 0 && (
        <div
          className="mt-3 rounded-xl border border-[var(--theme-border)] p-3"
          style={{ background: 'color-mix(in srgb, var(--theme-card) 70%, transparent)', backdropFilter: 'blur(10px)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Filter by tag</span>
            {tagFilter && (
              <button onClick={() => setTagFilter(null)}
                className="flex items-center gap-1 text-[10px] text-[var(--theme-accent)] hover:underline">
                <HugeiconsIcon icon={Cancel01Icon} size={10} /> Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tagCloud.map(([tag, count]) => (
              <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                  tagFilter === tag
                    ? ''
                    : 'border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-hover)]',
                )}
                style={tagFilter === tag ? {
                  background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                  color: 'var(--theme-accent)',
                  borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                } : undefined}>
                {tag}
                <span className={cn('rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums',
                  tagFilter === tag ? 'bg-[var(--theme-card)]' : 'bg-[var(--theme-hover)] text-[var(--theme-muted)]')}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban view ── */}
      {viewMode === 'kanban' && (
        <div className="mt-4">
          {contactsQuery.isLoading ? (
            <div className="overflow-x-auto">
              <div className="flex gap-3 pb-3 animate-pulse" style={{ minWidth: 900 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex w-52 shrink-0 flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] opacity-60">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--theme-border)]">
                      <div className="h-2 w-2 rounded-full bg-[var(--theme-muted)]" style={{ opacity: 0.4 }} />
                      <div className="h-2.5 w-20 rounded bg-[var(--theme-muted)]" style={{ opacity: 0.3 }} />
                    </div>
                    <div className="flex flex-col gap-2 p-2.5">
                      {[1,2].map(j => (
                        <div key={j} className="h-16 rounded-xl bg-[var(--theme-muted)]" style={{ opacity: 0.15 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <KanbanView
              contacts={filtered}
              onDelete={(id) => deleteMutation.mutate(id)}
              onMoveStage={(id, stage) => kanbanMoveMutation.mutate({ id, stage })}
            />
          )}
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {viewMode === 'list' && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2.5 shadow-2xl"
            style={{ backdropFilter: 'blur(20px)' }}>
            <span className="text-xs font-semibold text-[var(--theme-text)]">{selected.size} selected</span>
            <div className="h-4 w-px bg-[var(--theme-border)]" />
            <select
              value={bulkStage}
              onChange={e => setBulkStage(e.target.value as ContactStage | '')}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs text-[var(--theme-text)]"
            >
              <option value="">Change stage…</option>
              {CONTACT_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            {bulkStage && (
              <button
                onClick={() => { bulkStageMutation.mutate({ ids: Array.from(selected), stage: bulkStage as ContactStage }); setBulkStage('') }}
                className="rounded-lg px-3 py-1 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >Apply</button>
            )}
            <div className="h-4 w-px bg-[var(--theme-border)]" />
            <button
              onClick={() => { if (confirm(`Delete ${selected.size} contacts?`)) bulkDeleteMutation.mutate(Array.from(selected)) }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
            >
              <HugeiconsIcon icon={Delete01Icon} size={12} /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-lg p-1 hover:bg-[var(--theme-hover)]">
              <HugeiconsIcon icon={MultiplicationSignIcon} size={12} className="text-[var(--theme-muted)]" />
            </button>
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div className="mt-4 space-y-2">
          {contactsQuery.isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-md bg-[var(--theme-card)] opacity-60" />
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 opacity-60">
                    <div className="h-2 w-2 rounded-full bg-[var(--theme-muted)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 rounded bg-[var(--theme-muted)]" style={{ opacity: 0.3 }} />
                      <div className="h-2 w-1/2 rounded bg-[var(--theme-muted)]" style={{ opacity: 0.2 }} />
                    </div>
                    <div className="h-2 w-16 rounded bg-[var(--theme-muted)]" style={{ opacity: 0.2 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : contactsQuery.isError ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={AlertCircleIcon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">Could not load {term.toLowerCase()}</p>
              <p className="text-[11px] text-[var(--theme-muted)]">There was a problem fetching your data.</p>
              <button onClick={invalidate} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 && (contactsQuery.data?.length ?? 0) === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={UserGroupIcon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">Start building your CRM</p>
              <p className="text-[11px] text-[var(--theme-muted)]">Add your first {term === 'Patients' ? 'patient' : 'contact'} or import a CSV to get started.</p>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                  Add {term === 'Patients' ? 'Patient' : 'Contact'}
                </button>
                <button onClick={() => setShowImport(true)} className={ghostBtnCls}>
                  Import CSV
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={UserGroupIcon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">No {term.toLowerCase()} found</p>
              <p className="text-[11px] text-[var(--theme-muted)]">Try a different search term or clear the filter.</p>
              <button onClick={() => setShowCreate(true)} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                Add {term === 'Patients' ? 'Patient' : 'Contact'}
              </button>
            </div>
          ) : (
            <>
            {/* Select-all when any selected */}
            {selected.size > 0 && (
              <button onClick={toggleAll} className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--theme-accent)] hover:underline">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />
                {selected.size === filtered.length ? 'Deselect all' : `Select all ${filtered.length}`}
              </button>
            )}
            <AnimatePresence mode="popLayout">
              {filtered.map((c) => (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(c.id)}
                    className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      selected.has(c.id) ? 'border-transparent text-white' : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]')}
                    style={selected.has(c.id) ? { background: 'var(--theme-accent)' } : undefined}
                  >
                    {selected.has(c.id) && <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />}
                  </button>
                  <Link
                    to="/contacts/$id"
                    params={{ id: c.id }}
                    className="group flex flex-1 items-start justify-between gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">{c.name}</h3>
                          <StageBadge stage={c.stage} />
                          {(() => { const ls = computeLeadScore(c); return (
                            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white"
                              style={{ background: ls.color }} title={`Score: ${ls.score}/100 · ${ls.tier}`}>
                              {ls.score}
                            </span>
                          ) })()}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--theme-muted)]">
                          {c.company && <span className="flex items-center gap-1"><HugeiconsIcon icon={Building01Icon} size={11} />{c.company}</span>}
                          {c.email && <span className="flex items-center gap-1"><HugeiconsIcon icon={Mail01Icon} size={11} />{c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><HugeiconsIcon icon={SmartPhone01Icon} size={11} />{c.phone}</span>}
                        </div>
                        {c.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.tags.map((t) => <TagChip key={t} tag={t} />)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                      <Link
                        to="/contact/$id"
                        params={{ id: c.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-accent)] transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]"
                        title="View 360°"
                      >
                        <HugeiconsIcon icon={Analytics01Icon} size={13} />
                        360°
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id) }}
                        className="rounded-lg p-1.5 transition-colors"
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        title="Delete">
                        <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                      </button>
                    </div>
                  </Link>
                  </motion.div>
              ))}
            </AnimatePresence>
            </>
          )}
        </div>
      )}

      {/* ── Health view ── */}
      {viewMode === 'health' && (
        <HealthView brand={brand} />
      )}

      {showDupeScanner && (
        <DuplicateScannerModal
          contacts={contactsQuery.data ?? []}
          onDelete={(id) => deleteMutation.mutate(id)}
          onMerge={mergeMutation}
          onClose={() => setShowDupeScanner(false)}
        />
      )}
      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <ContactDialog open={showCreate} initial={EMPTY_FORM} title={`New ${term === 'Patients' ? 'Patient' : 'Contact'}`} isSubmitting={createMutation.isPending}
        onClose={() => setShowCreate(false)} onSubmit={(f) => createMutation.mutate(fromForm(f))} />
      {/* Edit dialog still available but we now navigate for viewing */}
      <ContactDialog open={editing !== null} initial={editing ? toForm(editing) : EMPTY_FORM} title="Edit Contact" isSubmitting={updateMutation.isPending}
        onClose={() => setEditing(null)} onSubmit={(f) => { if (editing) updateMutation.mutate({ id: editing.id, updates: fromForm(f) }) }} />
      </div>
    </div>
  )
}
