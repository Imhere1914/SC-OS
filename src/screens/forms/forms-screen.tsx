import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BarChartIcon,
  Calendar03Icon,
  CallIcon,
  Cancel01Icon,
  CheckmarkSquare01Icon,
  Delete01Icon,
  Mail01Icon,
  MenuSquareIcon,
  PencilEdit02Icon,
  RefreshIcon,
  SourceCodeIcon,
  TaskEdit01Icon,
  TextAlignLeftIcon,
  TextIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import {
  FIELD_TYPE_LABELS,
  createForm,
  deleteForm,
  fetchForms,
  updateForm,
} from '@/lib/forms-api'
import type {
  CreateFormInput,
  FieldType,
  FormField,
  FormRecord,
} from '@/lib/forms-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'forms'] as const

const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'date']

// ── Design tokens (shared vocabulary with Payroll / Payments) ────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const FIELD_TYPE_META: Record<FieldType, { icon: typeof TextIcon; color: string }> = {
  text: { icon: TextIcon, color: '#3b82f6' },
  email: { icon: Mail01Icon, color: '#8b5cf6' },
  phone: { icon: CallIcon, color: '#10b981' },
  textarea: { icon: TextAlignLeftIcon, color: '#0ea5e9' },
  select: { icon: MenuSquareIcon, color: '#f59e0b' },
  checkbox: { icon: CheckmarkSquare01Icon, color: '#f97316' },
  date: { icon: Calendar03Icon, color: '#ef4444' },
}

function GradientChip({ icon, size = 'md' }: { icon: typeof TextIcon; size?: 'md' | 'lg' }) {
  const px = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <span
      className={`flex ${px} shrink-0 items-center justify-center rounded-xl`}
      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
    >
      <HugeiconsIcon icon={icon} size={size === 'lg' ? 18 : 15} className="text-white" />
    </span>
  )
}

// Status as colored dot + soft tinted badge
function FormStatusBadge({ status }: { status: 'active' | 'draft' }) {
  const color = status === 'active' ? '#10b981' : '#94a3b8'
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
      {status === 'active' ? 'Active' : 'Draft'}
    </span>
  )
}

function newField(): FormField {
  return {
    id: crypto.randomUUID(),
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
  }
}

// ── Field editor row ─────────────────────────────────────────────────────────
function FieldRow({
  field,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField
  index: number
  total: number
  onChange: (f: FormField) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const set = <K extends keyof FormField>(k: K, v: FormField[K]) =>
    onChange({ ...field, [k]: v })

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 transition-all duration-150">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <input
            value={field.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Field label"
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          {/* Field-type picker — grid of tinted tiles */}
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {FIELD_TYPES.map((t) => {
              const meta = FIELD_TYPE_META[t]
              const active = field.type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  title={FIELD_TYPE_LABELS[t]}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-all duration-150',
                    active ? '' : 'hover:-translate-y-px',
                  )}
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${meta.color} 14%, var(--theme-card))`
                      : 'var(--theme-card)',
                    borderColor: active
                      ? `color-mix(in srgb, ${meta.color} 45%, transparent)`
                      : 'var(--theme-border)',
                  }}
                >
                  <HugeiconsIcon
                    icon={meta.icon}
                    size={13}
                    style={{ color: active ? meta.color : 'var(--theme-muted)' }}
                  />
                  <span
                    className="text-[8px] font-medium leading-none"
                    style={{ color: active ? meta.color : 'var(--theme-muted)' }}
                  >
                    {FIELD_TYPE_LABELS[t]}
                  </span>
                </button>
              )
            })}
          </div>
          {field.type !== 'checkbox' && field.type !== 'select' && (
            <input
              value={field.placeholder ?? ''}
              onChange={(e) => set('placeholder', e.target.value)}
              placeholder="Placeholder text (optional)"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          )}
          {field.type === 'select' && (
            <input
              value={(field.options ?? []).join(', ')}
              onChange={(e) => set('options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Options (comma-separated)"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-[var(--theme-muted)]">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => set('required', e.target.checked)}
              className="rounded"
            />
            Required
          </label>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)] disabled:opacity-30"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={12} className="text-[var(--theme-muted)]" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)] disabled:opacity-30"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} className="text-[var(--theme-muted)]" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Delete01Icon} size={12} style={{ color: 'var(--theme-danger)' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Live preview field (display only) ────────────────────────────────────────
function PreviewField({ field }: { field: FormField }) {
  const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-[11px] text-[var(--theme-text)]'
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium text-[var(--theme-text)]">
        {field.label || <em className="opacity-40">Untitled field</em>}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea rows={2} placeholder={field.placeholder ?? ''} readOnly className={`${inputCls} resize-none`} />
      ) : field.type === 'select' ? (
        <select className={inputCls} defaultValue="">
          <option value="" disabled>Select an option…</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-[11px] text-[var(--theme-text)]">
          <input type="checkbox" className="h-3.5 w-3.5 rounded border-[var(--theme-border)]" readOnly />
          <span>{field.placeholder || field.label || 'Checkbox'}</span>
        </label>
      ) : (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
          placeholder={field.placeholder ?? ''}
          readOnly
          className={inputCls}
        />
      )}
    </div>
  )
}

// ── Form dialog ──────────────────────────────────────────────────────────────
function FormDialog({
  open,
  initial,
  title,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: { name: string; description: string; fields: FormField[]; status: 'active' | 'draft' }
  title: string
  onClose: () => void
  onSubmit: (data: typeof initial) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState(initial)

  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const addField = () => setForm((f) => ({ ...f, fields: [...f.fields, newField()] }))

  const updateField = (idx: number, field: FormField) =>
    setForm((f) => { const fs = [...f.fields]; fs[idx] = field; return { ...f, fields: fs } })

  const deleteField = (idx: number) =>
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }))

  const moveField = (idx: number, dir: -1 | 1) =>
    setForm((f) => {
      const fs = [...f.fields]
      const swap = idx + dir
      if (swap < 0 || swap >= fs.length) return f;
      [fs[idx], fs[swap]] = [fs[swap], fs[idx]]
      return { ...f, fields: fs }
    })

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <GradientChip icon={TaskEdit01Icon} />
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)]">{title}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {form.fields.length} field{form.fields.length !== 1 ? 's' : ''} · {form.status === 'active' ? 'Active' : 'Draft'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
          {/* Editor column */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Form name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What's this form for?"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'draft' }))}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>

            {/* Fields */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                  Fields ({form.fields.length})
                </label>
                <button
                  onClick={addField}
                  className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-accent)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                >
                  <HugeiconsIcon icon={Add01Icon} size={10} />
                  Add field
                </button>
              </div>
              <div className="space-y-2">
                {form.fields.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[var(--theme-border)] py-6 text-center text-xs text-[var(--theme-muted)]">
                    No fields yet — click Add field to start
                  </p>
                )}
                {form.fields.map((field, idx) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={idx}
                    total={form.fields.length}
                    onChange={(f) => updateField(idx, f)}
                    onDelete={() => deleteField(idx)}
                    onMoveUp={() => moveField(idx, -1)}
                    onMoveDown={() => moveField(idx, 1)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Live preview panel */}
          <div className="hidden lg:block">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Live preview</label>
            <div
              className="sticky top-0 rounded-xl border border-[var(--theme-border)] p-4"
              style={{
                background: 'color-mix(in srgb, var(--theme-card) 70%, transparent)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <p className="mb-0.5 text-sm font-bold text-[var(--theme-text)]">
                {form.name || <em className="opacity-40">Untitled form</em>}
              </p>
              {form.description && (
                <p className="mb-2 text-[11px] text-[var(--theme-muted)]">{form.description}</p>
              )}
              {form.fields.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-[var(--theme-muted)]">Fields appear here as you add them.</p>
              ) : (
                <div className="mt-2 space-y-2.5">
                  {form.fields.map((field) => (
                    <PreviewField key={field.id} field={field} />
                  ))}
                  <span
                    className="mt-1 block w-full rounded-lg py-1.5 text-center text-[11px] font-semibold text-white"
                    style={{ background: ACCENT_GRADIENT }}
                  >
                    Submit
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || isSubmitting}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {isSubmitting ? 'Saving…' : 'Save Form'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Form preview modal ────────────────────────────────────────────────────────

function FormPreviewModal({ form, onClose }: { form: FormRecord; onClose: () => void }) {
  const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--theme-border)] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Browser chrome mock */}
        <div className="flex items-center gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 rounded-md bg-[var(--theme-input)] px-3 py-1 text-center text-[10px] text-[var(--theme-muted)]">
            Embedded form preview
          </div>
          <button onClick={onClose} className="text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>

        {/* Form body */}
        <div className="max-h-[70vh] overflow-y-auto bg-white p-6 dark:bg-[var(--theme-card)]">
          <h2 className="mb-1 text-xl font-bold text-[var(--theme-text)]">{form.name}</h2>
          {form.description && (
            <p className="mb-5 text-sm text-[var(--theme-muted)]">{form.description}</p>
          )}

          {form.fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No fields yet — add some in the editor.</p>
          ) : (
            <div className="space-y-4">
              {form.fields.map(field => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--theme-text)]">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} placeholder={field.placeholder ?? ''} readOnly
                      className={`${inputCls} resize-none`} />
                  ) : field.type === 'select' ? (
                    <select className={inputCls} defaultValue="">
                      <option value="" disabled>Select an option…</option>
                      {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm text-[var(--theme-text)]">
                      <input type="checkbox" className="h-4 w-4 rounded border-[var(--theme-border)]" readOnly />
                      <span>{field.placeholder ?? field.label}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.placeholder ?? ''}
                      readOnly
                      className={inputCls}
                    />
                  )}
                </div>
              ))}

              <button
                className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Form responses modal ─────────────────────────────────────────────────────

type FormSubmission = { id: string; fields: Record<string, string>; submitted_at: string; contact_id?: string }

function FormResponsesModal({ form, onClose }: { form: FormRecord; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['form-submissions', form.id],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${form.id}/submissions`)
      if (!res.ok) throw new Error('Failed to load')
      return ((await res.json()) as { submissions: FormSubmission[] }).submissions
    },
  })

  const exportCsv = () => {
    if (!data?.length) return
    const cols = Array.from(new Set(data.flatMap(s => Object.keys(s.fields))))
    const rows = [
      ['Submitted at', ...cols].join(','),
      ...data.map(s => [
        s.submitted_at,
        ...cols.map(c => `"${(s.fields[c] ?? '').replace(/"/g, '""')}"`)
      ].join(',')),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${form.name.toLowerCase().replace(/\s+/g, '-')}-responses.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <GradientChip icon={BarChartIcon} />
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)]">{form.name} — Responses</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                <span className="tabular-nums">{form.submissions_count}</span> total submission{form.submissions_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && data.length > 0 && (
              <button
                onClick={exportCsv}
                className="rounded-lg border border-[var(--theme-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--theme-accent)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
              >
                Export CSV
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[var(--theme-card)] opacity-60" style={{ filter: 'brightness(0.92)' }} />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-center text-sm text-[var(--theme-muted)]">No responses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.map((sub, i) => (
                <div key={sub.id} className="rounded-xl border border-[var(--theme-border)] p-3 transition-all duration-150 hover:border-[var(--theme-accent)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold tabular-nums text-[var(--theme-muted)]">#{data.length - i}</span>
                    <span className="text-[10px] text-[var(--theme-muted)]">
                      {new Date(sub.submitted_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {sub.contact_id && (
                      <span className="rounded-full bg-[var(--theme-accent-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--theme-accent)]">contact linked</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(sub.fields).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <span className="block text-[10px] text-[var(--theme-muted)]">{k}</span>
                        <span className="block truncate text-xs text-[var(--theme-text)]">{v || <em className="opacity-40">—</em>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', description: '', fields: [] as FormField[], status: 'draft' as const }

export function FormsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<FormRecord | null>(null)
  const [previewing, setPreviewing] = useState<FormRecord | null>(null)
  const [viewingResponses, setViewingResponses] = useState<FormRecord | null>(null)

  const formsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchForms({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateFormInput) => createForm(input),
    onSuccess: () => { invalidate(); toast('Form created'); setShowCreate(false) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to create', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateFormInput> }) => updateForm(p.id, p.updates),
    onSuccess: () => { invalidate(); toast('Form updated'); setEditing(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForm(id),
    onSuccess: () => { invalidate(); toast('Form deleted') },
  })

  const toggleStatus = (form: FormRecord) => {
    updateMutation.mutate({ id: form.id, updates: { status: form.status === 'active' ? 'draft' : 'active' } })
  }

  const toInitial = (f: FormRecord) => ({
    name: f.name,
    description: f.description,
    fields: f.fields,
    status: f.status,
  })

  const copyEmbedCode = (form: FormRecord) => {
    const code = `<script src="${location.origin}/embed/form.js" data-form-id="${form.id}"></script>`
    void navigator.clipboard.writeText(code)
    toast('Embed code copied')
  }

  const forms = formsQuery.data ?? []

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <GradientChip icon={TaskEdit01Icon} size="lg" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Forms</h1>
              <p className="text-xs text-[var(--theme-muted)]">
                {formsQuery.data ? `${forms.length} form${forms.length !== 1 ? 's' : ''} · ` : ''}
                Build intake forms and lead capture pages. Embed on any website.
              </p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} />
            New Form
          </button>
        </header>

        {/* List */}
        <div className="space-y-2">
          {formsQuery.isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-[var(--theme-card)] opacity-60" />
              ))}
            </div>
          ) : formsQuery.isError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
              <span
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))' }}
              >
                <HugeiconsIcon icon={AlertCircleIcon} size={24} className="text-[var(--theme-muted)]" />
              </span>
              <p className="font-semibold text-[var(--theme-text)]">Couldn't load forms</p>
              <p className="mb-4 mt-1 text-sm text-[var(--theme-muted)]">
                {formsQuery.error instanceof Error ? formsQuery.error.message : 'An error occurred'}
              </p>
              <button onClick={invalidate} className={primaryBtnCls} style={primaryBtnStyle}>
                <HugeiconsIcon icon={RefreshIcon} size={14} />
                Retry
              </button>
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, transparent), color-mix(in srgb, #000 18%, transparent))' }}
              >
                <HugeiconsIcon icon={TaskEdit01Icon} size={26} className="text-[var(--theme-accent)]" />
              </span>
              <p className="font-semibold text-[var(--theme-text)]">No forms yet</p>
              <p className="mb-4 mt-1 text-sm text-[var(--theme-muted)]">Capture leads and patient info with embeddable forms.</p>
              <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                Build your first form
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {forms.map((form) => (
                <motion.div
                  key={form.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="group rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--theme-accent)_40%,var(--theme-border))] hover:shadow-md"
                  style={{ backdropFilter: 'blur(10px)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <button onClick={() => toggleStatus(form)} title="Toggle status" className="transition-all duration-150 hover:opacity-80">
                          <FormStatusBadge status={form.status} />
                        </button>
                        <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">{form.name}</h3>
                      </div>
                      {form.description && (
                        <p className="mb-1.5 text-xs text-[var(--theme-muted)]">{form.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Submissions metric chip */}
                        {form.submissions_count > 0 ? (
                          <button
                            onClick={() => setViewingResponses(form)}
                            title="View form responses"
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-150 hover:-translate-y-px"
                            style={{
                              background: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))',
                              color: '#3b82f6',
                              border: '1px solid color-mix(in srgb, #3b82f6 30%, transparent)',
                            }}
                          >
                            <HugeiconsIcon icon={BarChartIcon} size={10} />
                            <span className="tabular-nums">{form.submissions_count}</span>
                            submission{form.submissions_count !== 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--theme-muted)]">no submissions yet</span>
                        )}
                        <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">
                          {form.fields.length} field{form.fields.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Share / embed — glass card */}
                      <div
                        className="mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                        style={{
                          background: 'color-mix(in srgb, var(--theme-card) 55%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--theme-border) 70%, transparent)',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        <HugeiconsIcon icon={SourceCodeIcon} size={12} className="shrink-0 text-[var(--theme-muted)]" />
                        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--theme-muted)]">
                          {`<script src=".../embed/form.js" data-form-id="${form.id}">`}
                        </code>
                        <button
                          onClick={() => copyEmbedCode(form)}
                          title="Copy embed code"
                          className="shrink-0 rounded-md border border-[var(--theme-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--theme-accent)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => setPreviewing(form)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        title="Preview form"
                      >
                        <HugeiconsIcon icon={ViewIcon} size={11} />
                        Preview
                      </button>
                      <button
                        onClick={() => setEditing(form)}
                        className="rounded-lg p-1.5 opacity-60 transition-all duration-150 hover:bg-[var(--theme-hover)] group-hover:opacity-100"
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} size={14} className="text-[var(--theme-muted)]" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${form.name}"?`)) deleteMutation.mutate(form.id) }}
                        className="rounded-lg p-1.5 opacity-60 transition-all duration-150 hover:bg-[var(--theme-hover)] group-hover:opacity-100"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {previewing && (
        <FormPreviewModal form={previewing} onClose={() => setPreviewing(null)} />
      )}
      {viewingResponses && (
        <FormResponsesModal form={viewingResponses} onClose={() => setViewingResponses(null)} />
      )}
      <FormDialog
        open={showCreate}
        initial={EMPTY_FORM}
        title="New Form"
        onClose={() => setShowCreate(false)}
        onSubmit={(f) =>
          createMutation.mutate({
            name: f.name.trim(),
            description: f.description,
            fields: f.fields,
            status: f.status,
            brand: brand.id !== 'hermes' ? brand.id : undefined,
          })
        }
        isSubmitting={createMutation.isPending}
      />
      <FormDialog
        open={editing !== null}
        initial={editing ? toInitial(editing) : EMPTY_FORM}
        title="Edit Form"
        onClose={() => setEditing(null)}
        onSubmit={(f) => {
          if (editing)
            updateMutation.mutate({
              id: editing.id,
              updates: { name: f.name.trim(), description: f.description, fields: f.fields, status: f.status },
            })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
