import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSequences,
  createSequence,
  updateSequence,
  deleteSequence,
  listEnrollments,
  enrollContact,
  unenroll,
  type Sequence,
  type SequenceStep,
} from '../lib/sequences-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { Add01Icon, Delete02Icon, PencilEdit02Icon, Cancel01Icon, UserAdd01Icon, Mail01Icon, UserGroupIcon, WorkflowSquare06Icon, Clock01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/sequences')({ component: SequencesPage })

// ── Design tokens (shared vocabulary with Payments / Payroll) ─────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_HEX: Record<string, string> = {
  active: '#10b981',
  completed: '#3b82f6',
  unsubscribed: '#94a3b8',
  bounced: '#ef4444',
  draft: '#f59e0b',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_HEX[status] ?? '#94a3b8'
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
      {status}
    </span>
  )
}

// Small tinted metric chip (steps / enrollment counts)
function MetricChip({ icon, label, color }: { icon: typeof Mail01Icon; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
      style={{
        background: `color-mix(in srgb, ${color} 10%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={icon} size={10} />
      {label}
    </span>
  )
}

// Tinted delay pill (used in step editor + sequence rows)
function DelayPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
      style={{
        background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
        color: '#f59e0b',
        border: '1px solid color-mix(in srgb, #f59e0b 25%, transparent)',
      }}
    >
      <HugeiconsIcon icon={Clock01Icon} size={9} />
      {label}
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Step editor ───────────────────────────────────────────────────────────────

function StepEditor({
  steps,
  onChange,
}: {
  steps: (SequenceStep & { id?: string })[]
  onChange: (steps: SequenceStep[]) => void
}) {
  function addStep() {
    onChange([...steps, { id: crypto.randomUUID(), subject: '', body: '', delay_days: 1 }])
  }
  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i))
  }
  function updateStep(i: number, patch: Partial<SequenceStep>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  return (
    <div>
      {steps.map((step, i) => (
        <div key={step.id ?? i} className="relative flex gap-3 pb-4">
          {/* Numbered chip + thin vertical connector */}
          <div className="flex shrink-0 flex-col items-center">
            <span
              className="z-[1] flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              {i + 1}
            </span>
            <span
              className="w-px flex-1"
              style={{ background: 'color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border))' }}
            />
          </div>

          <div className="min-w-0 flex-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                  Step {i + 1}
                </span>
                {i === 0 ? (
                  <DelayPill label="sent immediately on enroll" />
                ) : (
                  <DelayPill label={`+${step.delay_days}d after previous`} />
                )}
              </span>
              <button
                onClick={() => removeStep(i)}
                className="rounded-lg p-1 text-red-400 transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-red-600"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
              </button>
            </div>
            <div className="grid gap-2">
              {i > 0 && (
                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Delay (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={step.delay_days}
                    onChange={e => updateStep(i, { delay_days: parseInt(e.target.value) || 0 })}
                    className="w-20 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-sm tabular-nums text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
                  />
                  <span className="text-xs text-[var(--theme-muted)]">after previous step</span>
                </div>
              )}
              <input
                type="text"
                placeholder="Email subject"
                value={step.subject}
                onChange={e => updateStep(i, { subject: e.target.value })}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
              />
              <textarea
                rows={4}
                placeholder={`Email body — use {{contact_name}}, {{first_name}}, {{brand_name}}`}
                value={step.body}
                onChange={e => updateStep(i, { body: e.target.value })}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)] resize-y"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addStep}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} /> Add step
      </button>
    </div>
  )
}

// ── Sequence editor modal ─────────────────────────────────────────────────────

function SequenceModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Sequence
  onClose: () => void
  onSave: (data: Partial<Sequence>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [status, setStatus] = useState<'draft' | 'active'>(initial?.status ?? 'draft')
  const [steps, setSteps] = useState<SequenceStep[]>(initial?.steps ?? [])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl mb-12">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={WorkflowSquare06Icon} size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)]">
                {initial ? 'Edit sequence' : 'New sequence'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Automated multi-step email drip</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"><HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]"/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Details</p>
            <div className="flex gap-3">
              <input
                placeholder="Sequence name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
              />
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'draft' | 'active')}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Steps</p>
            <StepEditor steps={steps} onChange={setSteps} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onSave({ name, status, steps }) }}
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

// ── Enrollments modal ─────────────────────────────────────────────────────────

function EnrollmentsModal({
  seq,
  onClose,
}: {
  seq: Sequence
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', seq.id],
    queryFn: () => listEnrollments(seq.id),
  })
  const [showEnroll, setShowEnroll] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const enrollMutation = useMutation({
    mutationFn: () => enrollContact(seq.id, { contact_email: email, contact_name: name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['enrollments', seq.id] })
      toast('Enrolled')
      setShowEnroll(false)
      setEmail('')
      setName('')
    },
    onError: () => toast('Could not enroll — may already be active'),
  })

  const unenrollMutation = useMutation({
    mutationFn: (id: string) => unenroll(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['enrollments', seq.id] }),
  })

  const active = enrollments.filter(e => e.status === 'active').length
  const completed = enrollments.filter(e => e.status === 'completed').length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl mb-12">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={UserGroupIcon} size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)]">{seq.name}</h2>
              <p className="text-[11px] tabular-nums text-[var(--theme-muted)]">
                {active} active · {completed} completed · {enrollments.length - active - completed} other
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"><HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]"/></button>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Enrollments</p>
            <button
              onClick={() => setShowEnroll(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={UserAdd01Icon} size={12} /> Enroll contact
            </button>
          </div>

          {showEnroll && (
            <div className="mb-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Quick enroll</p>
              <div className="grid gap-2">
                <input
                  placeholder="Contact name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowEnroll(false)} className="text-xs text-[var(--theme-muted)] transition-colors duration-150 hover:text-[var(--theme-text)]">Cancel</button>
                  <button
                    onClick={() => enrollMutation.mutate()}
                    disabled={!email.includes('@') || !name.trim() || enrollMutation.isPending}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                    style={primaryBtnStyle}
                  >
                    Enroll
                  </button>
                </div>
              </div>
            </div>
          )}

          {enrollments.length === 0 ? (
            <p className="text-sm text-[var(--theme-muted)] text-center py-8">No enrollments yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {enrollments.map(e => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text)]">{e.contact_name}</p>
                    <p className="text-xs text-[var(--theme-muted)]">{e.contact_email}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      {e.status === 'active' && (
                        <span className="text-[10px] tabular-nums text-[var(--theme-muted)]">
                          Step {e.current_step + 1}/{seq.steps.length} — next {fmtDateTime(e.next_send_at)}
                        </span>
                      )}
                      {e.status === 'completed' && e.completed_at && (
                        <span className="text-[10px] text-[var(--theme-muted)]">Completed {fmtDate(e.completed_at)}</span>
                      )}
                    </div>
                  </div>
                  {e.status === 'active' && (
                    <button
                      onClick={() => unenrollMutation.mutate(e.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors duration-150"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SequencesPage() {
  const brand = useBrand()
  const qc = useQueryClient()

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['sequences', brand.id],
    queryFn: () => listSequences(brand.id),
  })

  const [editing, setEditing] = useState<Sequence | null | undefined>(undefined) // undefined = closed
  const [viewEnrollments, setViewEnrollments] = useState<Sequence | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: Partial<Sequence>) => createSequence({ ...data, brand: brand.id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sequences', brand.id] }); setEditing(undefined); toast('Sequence created') },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Sequence> }) => updateSequence(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sequences', brand.id] }); setEditing(undefined); toast('Saved') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSequence(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sequences', brand.id] }),
  })

  const toggleStatus = (seq: Sequence) => {
    updateMutation.mutate({
      id: seq.id,
      data: { status: seq.status === 'active' ? 'draft' : 'active' },
    })
  }

  function handleSave(data: Partial<Sequence>) {
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={WorkflowSquare06Icon} size={18} />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Sequences</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {sequences.length > 0
                ? `${sequences.length} sequence${sequences.length === 1 ? '' : 's'} · automated multi-step email drip campaigns`
                : 'Automated multi-step email drip campaigns'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(null)}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} /> New sequence
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid animate-pulse gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[76px] rounded-2xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 16%, var(--theme-card)), color-mix(in srgb, #000 12%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Mail01Icon} size={24} />
          </span>
          <p className="font-semibold text-[var(--theme-text)]">No sequences yet</p>
          <p className="text-sm text-[var(--theme-muted)]">Create a drip sequence to automatically nurture contacts</p>
          <button onClick={() => setEditing(null)} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} /> New sequence
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sequences.map(seq => (
            <div
              key={seq.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--theme-text)]">{seq.name}</p>
                    <StatusBadge status={seq.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <MetricChip
                      icon={WorkflowSquare06Icon}
                      color="#3b82f6"
                      label={`${seq.steps.length} step${seq.steps.length === 1 ? '' : 's'}`}
                    />
                    {seq.steps.length > 0 && (
                      <span className="flex items-center gap-1">
                        {seq.steps.map((s, i) => (
                          <DelayPill key={s.id} label={i > 0 ? `+${s.delay_days}d` : 'Day 0'} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewEnrollments(seq)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
                >
                  <HugeiconsIcon icon={UserGroupIcon} size={12} />
                  Enrollments
                </button>
                <button
                  onClick={() => toggleStatus(seq)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150"
                  style={
                    seq.status === 'active'
                      ? {
                          color: '#10b981',
                          background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                          border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
                        }
                      : {
                          color: 'var(--theme-muted)',
                          border: '1px solid var(--theme-border)',
                        }
                  }
                >
                  {seq.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => setEditing(seq)} className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]">
                  <HugeiconsIcon icon={PencilEdit02Icon} size={15} className="text-[var(--theme-muted)]"/>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${seq.name}"?`)) deleteMutation.mutate(seq.id)
                  }}
                  className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={15} className="text-red-400"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editing !== undefined && (
        <SequenceModal
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
        />
      )}
      {viewEnrollments && (
        <EnrollmentsModal seq={viewEnrollments} onClose={() => setViewEnrollments(null)} />
      )}
    </div>
  )
}
