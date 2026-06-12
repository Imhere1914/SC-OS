import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  type Deal,
  type DealStage,
} from '../lib/deals-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { Add01Icon, AlertCircleIcon, BriefcaseDollarIcon, Delete02Icon, PencilEdit02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/deals')({ component: DealsPage })

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: { id: DealStage; label: string }[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

// Stage accent colors (consistent across CRM screens)
const STAGE_COLORS: Record<DealStage, string> = {
  lead: '#94a3b8',
  qualified: '#0ea5e9',
  proposal: '#3b82f6',
  negotiation: '#f59e0b',
  won: '#10b981',
  lost: '#ef4444',
}

const ACCENT_GRADIENT = (accent: string) =>
  `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))`
const ACCENT_GLOW = (accent: string) =>
  `0 2px 8px color-mix(in srgb, ${accent} 38%, transparent)`

const inputCls =
  'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'

function fmtDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// ── Deal form modal ────────────────────────────────────────────────────────────

function DealModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Deal
  onClose: () => void
  onSave: (data: Partial<Deal>) => void
}) {
  const brand = useBrand()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [valueDollars, setValueDollars] = useState(initial ? String(initial.value / 100) : '')
  const [stage, setStage] = useState<DealStage>(initial?.stage ?? 'lead')
  const [probability, setProbability] = useState(initial?.probability != null ? String(initial.probability) : '')
  const [closeDate, setCloseDate] = useState(initial?.close_date?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
            >
              <HugeiconsIcon icon={initial ? PencilEdit02Icon : BriefcaseDollarIcon} size={17} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">{initial ? 'Edit deal' : 'New deal'}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {initial ? 'Update the details of this deal' : 'Add a deal to your pipeline'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]"/>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input
            placeholder="Deal title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Contact name"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[var(--theme-muted)]">$</span>
              <input
                type="number"
                min={0}
                placeholder="Value"
                value={valueDollars}
                onChange={e => setValueDollars(e.target.value)}
                className={`${inputCls} pl-6 tabular-nums`}
              />
            </div>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as DealStage)}
              className={inputCls}
            >
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Probability %"
                value={probability}
                onChange={e => setProbability(e.target.value)}
                className={`${inputCls} tabular-nums`}
              />
            </div>
            <input
              type="date"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            disabled={!title.trim()}
            onClick={() => onSave({
              title,
              contact_name: contactName || undefined,
              value: Math.round(parseFloat(valueDollars || '0') * 100),
              stage,
              probability: probability ? parseInt(probability) : undefined,
              close_date: closeDate || undefined,
              notes: notes || undefined,
            })}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onEdit,
  onDelete,
  onDragStart,
}: {
  deal: Deal
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
}) {
  const stageColor = STAGE_COLORS[deal.stage]
  const isOpen = !['won', 'lost'].includes(deal.stage)
  const ageDays = daysSince(deal.created_at)
  const idleDays = daysSince(deal.updated_at)
  const isStale = isOpen && idleDays >= 14

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md active:cursor-grabbing"
      style={{ backdropFilter: 'blur(10px)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${stageColor} 45%, var(--theme-border))` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold leading-snug text-[var(--theme-text)]">{deal.title}</p>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={onEdit} className="rounded p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={PencilEdit02Icon} size={12} className="text-[var(--theme-muted)]"/>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 transition-all duration-150"
            style={{ color: '#ef4444' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <HugeiconsIcon icon={Delete02Icon} size={12} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-bold leading-none tabular-nums text-[var(--theme-text)]">
          {deal.value > 0 ? fmtDollars(deal.value) : '—'}
        </span>
        {deal.probability != null && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{
              color: stageColor,
              background: `color-mix(in srgb, ${stageColor} 12%, var(--theme-card))`,
            }}
          >
            {deal.probability}%
          </span>
        )}
      </div>

      {deal.contact_name && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${stageColor}, color-mix(in srgb, ${stageColor} 65%, #000))` }}
          >
            {deal.contact_name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-[11px] text-[var(--theme-muted)]">{deal.contact_name}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--theme-muted)] tabular-nums">
          {deal.close_date
            ? `Close ${new Date(deal.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : `${ageDays}d in pipeline`}
        </span>
        {isStale && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              color: '#f59e0b',
              background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
            }}
          >
            <span className="h-1 w-1 rounded-full" style={{ background: '#f59e0b' }} />
            {idleDays}d idle
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function DealsPage() {
  const brand = useBrand()
  const qc = useQueryClient()

  const { data: deals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['deals', brand.id],
    queryFn: () => listDeals(brand.id),
  })

  const [editing, setEditing] = useState<Deal | null | undefined>(undefined)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<DealStage | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: Partial<Deal>) => createDeal({ ...data, brand: brand.id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['deals', brand.id] }); setEditing(undefined); toast('Deal created') },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Deal> }) => updateDeal(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['deals', brand.id] }); setEditing(undefined) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals', brand.id] }),
  })

  function handleDrop(stage: DealStage) {
    if (!draggingId) return
    const deal = deals.find(d => d.id === draggingId)
    if (deal && deal.stage !== stage) {
      updateMutation.mutate({ id: draggingId, data: { stage } })
      toast(`Moved to ${stage}`)
    }
    setDraggingId(null)
    setOverStage(null)
  }

  // Pipeline totals
  const totalPipeline = deals
    .filter(d => !['won', 'lost'].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0)
  const totalWon = deals.filter(d => d.stage === 'won').reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
          >
            <HugeiconsIcon icon={BriefcaseDollarIcon} size={19} className="text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Deals</h1>
            <div className="flex items-center gap-3 text-xs text-[var(--theme-muted)]">
              <span>
                Pipeline <strong className="tabular-nums" style={{ color: brand.accentColor }}>{fmtDollars(totalPipeline)}</strong>
              </span>
              <span className="h-3 w-px bg-[var(--theme-border)]" />
              <span>
                Won <strong className="tabular-nums" style={{ color: '#10b981' }}>{fmtDollars(totalWon)}</strong>
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} /> New deal
        </button>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-4 animate-pulse">
            {STAGES.map(stage => (
              <div
                key={stage.id}
                className="flex w-60 shrink-0 flex-col rounded-2xl border border-[var(--theme-border)] opacity-60"
              >
                <div
                  className="rounded-t-2xl px-3 py-2.5"
                  style={{ background: `color-mix(in srgb, ${STAGE_COLORS[stage.id]} 10%, var(--theme-card))` }}
                >
                  <div className="h-3 w-20 rounded bg-[var(--theme-muted)] opacity-30" />
                </div>
                <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                  {[1, 2].map(j => (
                    <div key={j} className="h-20 rounded-xl bg-[var(--theme-card)]" style={{ border: '1px solid var(--theme-border)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--theme-card)), color-mix(in srgb, #ef4444 6%, var(--theme-card)))' }}
          >
            <HugeiconsIcon icon={AlertCircleIcon} size={26} style={{ color: '#ef4444' }} />
          </span>
          <p className="font-semibold text-[var(--theme-text)]">Couldn't load deals</p>
          <p className="text-sm text-[var(--theme-muted)] mt-1 mb-4">There was a problem fetching your pipeline.</p>
          <button
            onClick={() => void refetch()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
          >
            Try again
          </button>
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${brand.accentColor} 16%, var(--theme-card)), color-mix(in srgb, ${brand.accentColor} 6%, var(--theme-card)))` }}
          >
            <HugeiconsIcon icon={BriefcaseDollarIcon} size={26} style={{ color: brand.accentColor }} />
          </span>
          <p className="font-semibold text-[var(--theme-text)]">Your pipeline is empty</p>
          <p className="text-sm text-[var(--theme-muted)] mt-1 mb-4">Add your first deal to start tracking revenue.</p>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
          >
            <HugeiconsIcon icon={Add01Icon} size={15} />
            Add first deal
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-4">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage.id)
              const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0)
              const isOver = overStage === stage.id
              const stageColor = STAGE_COLORS[stage.id]

              return (
                <div
                  key={stage.id}
                  className="flex w-60 flex-col rounded-2xl border transition-all duration-150"
                  style={{
                    borderColor: isOver ? stageColor : 'var(--theme-border)',
                    boxShadow: isOver ? `0 4px 16px color-mix(in srgb, ${stageColor} 25%, transparent)` : undefined,
                    background: `color-mix(in srgb, ${stageColor} 3%, transparent)`,
                  }}
                  onDragOver={e => { e.preventDefault(); setOverStage(stage.id) }}
                  onDragLeave={() => setOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  {/* Column header */}
                  <div
                    className="rounded-t-2xl px-3 py-2.5"
                    style={{ background: `color-mix(in srgb, ${stageColor} 10%, var(--theme-card))` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: stageColor }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: stageColor }} />
                        {stage.label}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                        style={{
                          color: stageColor,
                          background: `color-mix(in srgb, ${stageColor} 14%, var(--theme-card))`,
                        }}
                      >
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageTotal > 0 && (
                      <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-[var(--theme-muted)]">{fmtDollars(stageTotal)}</p>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                    {stageDeals.map(deal => (
                      <div
                        key={deal.id}
                        style={{ opacity: draggingId === deal.id ? 0.4 : 1 }}
                      >
                        <DealCard
                          deal={deal}
                          onEdit={() => setEditing(deal)}
                          onDelete={() => {
                            if (confirm(`Delete "${deal.title}"?`)) deleteMutation.mutate(deal.id)
                          }}
                          onDragStart={() => setDraggingId(deal.id)}
                        />
                      </div>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-4 opacity-40">
                        <p className="text-xs text-[var(--theme-muted)]">{isOver ? 'Drop here' : 'No deals'}</p>
                        {!isOver && (
                          <button
                            onClick={() => setEditing(null)}
                            className="mt-1.5 flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:opacity-100"
                          >
                            <HugeiconsIcon icon={Add01Icon} size={10} /> Add deal
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {editing !== undefined && (
        <DealModal
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={data => {
            if (editing?.id) {
              updateMutation.mutate({ id: editing.id, data })
            } else {
              createMutation.mutate(data)
            }
          }}
        />
      )}
    </div>
  )
}
