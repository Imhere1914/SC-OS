import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  previewSegment,
  type Segment,
  type SegmentFilter,
  type FilterOperator,
} from '../lib/segments-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { Add01Icon, Delete02Icon, PencilEdit02Icon, Cancel01Icon, UserGroup03Icon, FilterIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/segments')({ component: SegmentsPage })

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

// Mono tinted rule chip, e.g. `tag = vip`
function RuleChip({ filter }: { filter: SegmentFilter }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 font-mono text-[10px] font-medium"
      style={{
        background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
        color: 'var(--theme-accent)',
        border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
      }}
    >
      {filter.field} {filter.operator.replace(/_/g, ' ')}{filter.value ? ` "${filter.value}"` : ''}
    </span>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'city', label: 'City' },
  { value: 'stage', label: 'Stage' },
  { value: 'tags', label: 'Tags' },
  { value: 'lead_score', label: 'Lead score' },
  { value: 'notes', label: 'Notes' },
  { value: 'source', label: 'Source' },
]

const OPERATORS: { value: FilterOperator; label: string; noValue?: boolean }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_set', label: 'is set', noValue: true },
  { value: 'is_not_set', label: 'is not set', noValue: true },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
]

// ── Filter row ────────────────────────────────────────────────────────────────

function FilterRow({
  filter,
  onChange,
  onRemove,
}: {
  filter: SegmentFilter
  onChange: (f: SegmentFilter) => void
  onRemove: () => void
}) {
  const op = OPERATORS.find(o => o.value === filter.operator)

  return (
    <div className="flex items-center gap-2">
      <select
        value={filter.field}
        onChange={e => onChange({ ...filter, field: e.target.value })}
        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-sm text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
      >
        {FILTER_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        <option value="custom_fields.custom">Custom field…</option>
      </select>

      {filter.field === 'custom_fields.custom' && (
        <input
          placeholder="field key"
          value={filter.field.replace('custom_fields.', '')}
          onChange={e => onChange({ ...filter, field: `custom_fields.${e.target.value}` })}
          className="w-28 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-sm text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
      )}

      <select
        value={filter.operator}
        onChange={e => onChange({ ...filter, operator: e.target.value as FilterOperator })}
        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-sm text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
      >
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {!op?.noValue && (
        <input
          placeholder="value"
          value={filter.value ?? ''}
          onChange={e => onChange({ ...filter, value: e.target.value })}
          className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
      )}

      <button onClick={onRemove} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
        <HugeiconsIcon icon={Cancel01Icon} size={14} />
      </button>
    </div>
  )
}

// ── Segment editor modal ──────────────────────────────────────────────────────

function SegmentModal({
  initial,
  brand,
  onClose,
  onSave,
}: {
  initial?: Segment
  brand: string
  onClose: () => void
  onSave: (data: Partial<Segment>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [filters, setFilters] = useState<SegmentFilter[]>(initial?.filters ?? [])
  const [preview, setPreview] = useState<{ count: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  function addFilter() {
    setFilters(prev => [...prev, { field: 'name', operator: 'contains', value: '' }])
  }
  function updateFilter(i: number, f: SegmentFilter) {
    setFilters(prev => prev.map((x, idx) => idx === i ? f : x))
  }
  function removeFilter(i: number) {
    setFilters(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handlePreview() {
    setPreviewing(true)
    try {
      const result = await previewSegment(filters, brand)
      setPreview({ count: result.count })
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl mb-12"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={FilterIcon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{initial ? 'Edit segment' : 'New segment'}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Saved audience built from contact filters</p>
            </div>
          </div>
          <button onClick={onClose}><HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]"/></button>
        </div>
        <div className="p-5 space-y-4">
          <input
            placeholder="Segment name *"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-[var(--theme-muted)] uppercase tracking-wider">Filters (ALL must match)</p>
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-xs text-[var(--theme-accent)] hover:opacity-80"
              >
                <HugeiconsIcon icon={Add01Icon} size={12} /> Add filter
              </button>
            </div>
            <div className="space-y-2">
              {filters.map((f, i) => (
                <FilterRow
                  key={i}
                  filter={f}
                  onChange={upd => updateFilter(i, upd)}
                  onRemove={() => removeFilter(i)}
                />
              ))}
              {filters.length === 0 && (
                <p className="text-xs text-[var(--theme-muted)] opacity-60">No filters — will match all contacts</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handlePreview()}
              disabled={previewing}
              className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors disabled:opacity-50"
            >
              {previewing ? 'Checking…' : 'Preview count'}
            </button>
            {preview && (
              <span className="text-sm font-semibold tabular-nums text-[var(--theme-accent)]">
                {preview.count} matching contacts
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] hover:text-[var(--theme-text)]">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onSave({ name, description: description || undefined, filters })}
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

function SegmentsPage() {
  const brand = useBrand()
  const qc = useQueryClient()

  const { data: segments = [], isLoading } = useQuery({
    queryKey: ['segments', brand.id],
    queryFn: () => listSegments(brand.id),
  })

  const [editing, setEditing] = useState<Segment | null | undefined>(undefined)
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({})

  const createMutation = useMutation({
    mutationFn: (data: Partial<Segment>) => createSegment({ ...data, brand: brand.id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['segments', brand.id] }); setEditing(undefined); toast('Segment saved') },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Segment> }) => updateSegment(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['segments', brand.id] }); setEditing(undefined); toast('Saved') },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSegment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['segments', brand.id] }),
  })

  async function loadCount(seg: Segment) {
    try {
      const res = await fetch(`/api/segments/${seg.id}/contacts`)
      const d = await res.json() as { count: number }
      setPreviewCounts(prev => ({ ...prev, [seg.id]: d.count }))
    } catch { /* silent */ }
  }

  function handleSave(data: Partial<Segment>) {
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={UserGroup03Icon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Segments</h1>
            <p className="text-[12px] text-[var(--theme-muted)]">
              {segments.length > 0
                ? `${segments.length} segment${segments.length !== 1 ? 's' : ''} · saved contact audiences based on filters`
                : 'Saved contact audiences based on filters'}
            </p>
          </div>
        </div>
        <button onClick={() => setEditing(null)} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={16} /> New segment
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border opacity-60"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            />
          ))}
        </div>
      ) : segments.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={UserGroup03Icon} size={22} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">No segments yet</p>
          <p className="text-[11px] text-[var(--theme-muted)]">Create segments to target specific contact groups in campaigns</p>
          <button onClick={() => setEditing(null)} className={`${primaryBtnCls} mt-2`} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={13} /> New segment
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {segments.map(seg => (
            <div
              key={seg.id}
              className="group flex items-center justify-between rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div>
                <p className="font-semibold text-[var(--theme-text)]">{seg.name}</p>
                {seg.description && (
                  <p className="text-xs text-[var(--theme-muted)] mt-0.5">{seg.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {seg.filters.map((f, i) => (
                    <RuleChip key={i} filter={f} />
                  ))}
                  {seg.filters.length === 0 && (
                    <span className="text-xs text-[var(--theme-muted)] opacity-60">All contacts</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void loadCount(seg)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-all duration-150 hover:-translate-y-px"
                  style={{
                    background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                    color: 'var(--theme-accent)',
                    border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
                  }}
                  title="Member count"
                >
                  <HugeiconsIcon icon={UserGroup03Icon} size={12} />
                  {previewCounts[seg.id] != null ? `${previewCounts[seg.id]} members` : 'Count'}
                </button>
                <button
                  onClick={() => setEditing(seg)}
                  className="rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--theme-hover)]"
                  title="Edit"
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} size={15} className="text-[var(--theme-muted)]"/>
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${seg.name}"?`)) deleteMutation.mutate(seg.id) }}
                  className="rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--theme-hover)]"
                  title="Delete"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={15} className="text-red-400"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <SegmentModal
          initial={editing ?? undefined}
          brand={brand.id}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
