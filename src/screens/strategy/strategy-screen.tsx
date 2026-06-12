import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  JusticeScale01Icon,
  PencilEdit02Icon,
  Target02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import {
  DECISION_IMPACTS, DECISION_STATUS_LABELS, DECISION_STATUSES,
  IMPACT_COLORS, OKR_CYCLES, OKR_STATUS_COLORS, OKR_STATUSES,
  createDecision, createOkr, deleteDecision, deleteOkr,
  fetchDecisions, fetchOkrs, updateDecision, updateOkr,
  type DecisionImpact, type DecisionRecord, type DecisionStatus,
  type KeyResult, type OkrCycle, type OkrRecord, type OkrStatus,
} from '@/lib/strategy-api'

// ── Design tokens (shared vocabulary with Payments / Mission Control) ────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md'
const primaryBtnStyle: React.CSSProperties = {
  background: ACCENT_GRADIENT,
  boxShadow: ACCENT_GLOW,
}

// Gradient icon chip used on section cards
function GradientChip({ icon, color, size = 8 }: { icon: typeof Target02Icon; color: string; size?: 8 | 9 }) {
  return (
    <span
      className={`flex ${size === 9 ? 'h-9 w-9' : 'h-8 w-8'} shrink-0 items-center justify-center rounded-lg`}
      style={{
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
        boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={icon} size={size === 9 ? 16 : 14} className="text-white" />
    </span>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function inputCls(extra = '') { return `w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none ${extra}` }
const inputStyle = { borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }

// ── OKR form ──────────────────────────────────────────────────────────────────

function OkrModal({ initial, onSave, onClose }: {
  initial?: OkrRecord | null
  onSave: (data: Omit<OkrRecord, 'id'|'brand'|'created_at'|'updated_at'>) => void
  onClose: () => void
}) {
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [cycle, setCycle] = useState<OkrCycle>(initial?.cycle ?? 'Q1')
  const [year, setYear] = useState(initial?.year ?? new Date().getFullYear())
  const [status, setStatus] = useState<OkrStatus>(initial?.status ?? 'on-track')
  const [owner, setOwner] = useState(initial?.owner ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [krs, setKrs] = useState<KeyResult[]>(initial?.key_results ?? [])

  const addKr = () => setKrs(k => [...k, { id: crypto.randomUUID(), description: '', target: '', current: '', progress: 0 }])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border shadow-2xl" style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Target02Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">{initial ? 'Edit OKR' : 'New OKR'}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">Objective and measurable key results</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Objective</p>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objective (what we want to achieve)" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Cycle &amp; owner</p>
            <div className="grid grid-cols-3 gap-2">
              <select value={cycle} onChange={e => setCycle(e.target.value as OkrCycle)} className={inputCls()} style={inputStyle}>
                {OKR_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls()} style={inputStyle} />
              <select value={status} onChange={e => setStatus(e.target.value as OkrStatus)} className={inputCls()} style={inputStyle}>
                {OKR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" className={`${inputCls()} mt-2`} style={inputStyle} />
          </div>

          {/* Key Results */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Key Results</span>
              <button onClick={addKr} className="flex items-center gap-1 text-[12px] font-medium transition-colors" style={{ color: 'var(--theme-accent)' }}>
                <HugeiconsIcon icon={Add01Icon} size={12} /> Add KR
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {krs.map((kr, i) => (
                <div key={kr.id} className="flex items-start gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <input value={kr.description} onChange={e => setKrs(k => k.map((x,j) => j===i ? {...x, description: e.target.value} : x))}
                      placeholder="Description" className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={inputStyle} />
                    <div className="flex gap-1">
                      <input value={kr.target} onChange={e => setKrs(k => k.map((x,j) => j===i ? {...x, target: e.target.value} : x))}
                        placeholder="Target" className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={inputStyle} />
                      <input value={kr.current} onChange={e => setKrs(k => k.map((x,j) => j===i ? {...x, current: e.target.value} : x))}
                        placeholder="Current" className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={inputStyle} />
                      <input type="number" min={0} max={100} value={kr.progress} onChange={e => setKrs(k => k.map((x,j) => j===i ? {...x, progress: Number(e.target.value)} : x))}
                        placeholder="%" className="w-16 rounded-lg border px-2 py-1.5 text-[12px] tabular-nums outline-none" style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={() => setKrs(k => k.filter((_,j) => j!==i))} className="mt-1 rounded-lg p-1 transition-colors hover:bg-[var(--theme-hover)]" style={{ color: 'var(--theme-danger)' }}>
                    <HugeiconsIcon icon={Delete01Icon} size={13} />
                  </button>
                </div>
              ))}
              {krs.length === 0 && <p className="text-[12px] text-[var(--theme-muted)]">No key results yet</p>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]" style={{ borderColor: 'var(--theme-border)' }}>Cancel</button>
          <button onClick={() => {
            if (!objective.trim()) { toast('Objective is required', { type: 'error' }); return }
            onSave({ objective, cycle, year, status, owner, notes, key_results: krs })
          }} className={primaryBtnCls} style={primaryBtnStyle}>
            {initial ? 'Save' : 'Create OKR'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Decision form ─────────────────────────────────────────────────────────────

function DecisionModal({ initial, onSave, onClose }: {
  initial?: DecisionRecord | null
  onSave: (data: Omit<DecisionRecord, 'id'|'brand'|'created_at'|'updated_at'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [context, setContext] = useState(initial?.context ?? '')
  const [options, setOptions] = useState(initial?.options_considered ?? '')
  const [decision, setDecision] = useState(initial?.decision ?? '')
  const [rationale, setRationale] = useState(initial?.rationale ?? '')
  const [owner, setOwner] = useState(initial?.owner ?? '')
  const [impact, setImpact] = useState<DecisionImpact>(initial?.impact ?? 'medium')
  const [status, setStatus] = useState<DecisionStatus>(initial?.status ?? 'pending')
  const [reviewDate, setReviewDate] = useState(initial?.review_date ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border shadow-2xl" style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={JusticeScale01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">{initial ? 'Edit Decision' : 'Log a Decision'}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">Context, options, and rationale for later review</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Decision</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Decision title" className={inputCls()} style={inputStyle} />
          <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="Context — what problem/situation prompted this?" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          <textarea value={options} onChange={e => setOptions(e.target.value)} placeholder="Options considered" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          <textarea value={decision} onChange={e => setDecision(e.target.value)} placeholder="What was decided?" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          <textarea value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Why? Rationale / trade-offs" rows={2} className={`${inputCls()} resize-none`} style={inputStyle} />
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Ownership &amp; review</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" className={inputCls()} style={inputStyle} />
            <select value={impact} onChange={e => setImpact(e.target.value as DecisionImpact)} className={inputCls()} style={inputStyle}>
              {DECISION_IMPACTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value as DecisionStatus)} className={inputCls()} style={inputStyle}>
              {DECISION_STATUSES.map(s => <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} className={inputCls()} style={inputStyle} placeholder="Review date (optional)" />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]" style={{ borderColor: 'var(--theme-border)' }}>Cancel</button>
          <button onClick={() => {
            if (!title.trim()) { toast('Title is required', { type: 'error' }); return }
            onSave({ title, context, options_considered: options, decision, rationale, owner, impact, status, review_date: reviewDate || null })
          }} className={primaryBtnCls} style={primaryBtnStyle}>
            {initial ? 'Save' : 'Log Decision'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = 'okrs' | 'decisions'

export function StrategyScreen() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('okrs')
  const [okrModal, setOkrModal] = useState<'new' | OkrRecord | null>(null)
  const [decisionModal, setDecisionModal] = useState<'new' | DecisionRecord | null>(null)

  const { data: okrs = [] } = useQuery({ queryKey: ['strategy-okrs'], queryFn: fetchOkrs })
  const { data: decisions = [] } = useQuery({ queryKey: ['strategy-decisions'], queryFn: fetchDecisions })

  const createOkrM = useMutation({
    mutationFn: createOkr, onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategy-okrs'] }); setOkrModal(null); toast('OKR created') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })
  const updateOkrM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateOkr>[1] }) => updateOkr(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategy-okrs'] }); setOkrModal(null); toast('Saved') },
  })
  const deleteOkrM = useMutation({ mutationFn: deleteOkr, onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy-okrs'] }) })

  const createDecisionM = useMutation({
    mutationFn: createDecision, onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategy-decisions'] }); setDecisionModal(null); toast('Decision logged') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })
  const updateDecisionM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateDecision>[1] }) => updateDecision(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategy-decisions'] }); setDecisionModal(null); toast('Saved') },
  })
  const deleteDecisionM = useMutation({ mutationFn: deleteDecision, onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy-decisions'] }) })

  const tabAction = tab === 'okrs'
    ? <button onClick={() => setOkrModal('new')} className={primaryBtnCls} style={primaryBtnStyle}><HugeiconsIcon icon={Add01Icon} size={15} />New OKR</button>
    : <button onClick={() => setDecisionModal('new')} className={primaryBtnCls} style={primaryBtnStyle}><HugeiconsIcon icon={Add01Icon} size={15} />Log Decision</button>

  return (
    <>
      <ScreenShell
        icon={Target02Icon}
        title="Strategy Partner"
        subtitle="OKRs, key results, and decision log"
        action={tabAction}
      >
        {/* Tabs — segmented control */}
        <div className="mb-5 flex w-fit gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
          {(['okrs', 'decisions'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all ${tab === t ? 'shadow-sm' : ''}`}
              style={tab === t
                ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }
                : { color: 'var(--theme-muted)' }}>
              {t === 'okrs' ? 'OKRs' : 'Decisions'}
              <span className="ml-1 opacity-60 tabular-nums">{t === 'okrs' ? okrs.length : decisions.length}</span>
            </button>
          ))}
        </div>

        {/* ── OKRs ── */}
        {tab === 'okrs' && (
          okrs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={Target02Icon} size={22} />
              </span>
              <p className="text-[14px] font-semibold text-[var(--theme-text)]">No OKRs yet</p>
              <p className="text-[12px] text-[var(--theme-muted)]">Set objectives and key results to track your most important goals.</p>
              <button onClick={() => setOkrModal('new')} className={`${primaryBtnCls} mt-2`} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={13} /> Create first OKR
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {okrs.map(okr => {
                const sc = OKR_STATUS_COLORS[okr.status]
                const avgProgress = okr.key_results.length
                  ? Math.round(okr.key_results.reduce((s, kr) => s + kr.progress, 0) / okr.key_results.length)
                  : 0
                return (
                  <div key={okr.id} className="group rounded-2xl border p-4 transition-all hover:-translate-y-px hover:shadow-md" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <GradientChip icon={Target02Icon} color="var(--theme-accent)" size={9} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                                color: 'var(--theme-accent)',
                                border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                              }}
                            >
                              {okr.cycle} {okr.year}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: sc.bg, color: sc.text }}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                              {okr.status}
                            </span>
                            {okr.owner && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--theme-muted)]">
                                <HugeiconsIcon icon={UserIcon} size={11} /> {okr.owner}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[13px] font-semibold text-[var(--theme-text)]">{okr.objective}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button onClick={() => setOkrModal(okr)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]" style={{ color: 'var(--theme-muted)' }} title="Edit">
                          <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                        </button>
                        <button
                          onClick={() => deleteOkrM.mutate(okr.id)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: 'var(--theme-danger)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {okr.key_results.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                          <span>Overall progress</span><span className="tabular-nums" style={{ color: sc.text }}>{avgProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${avgProgress}%`, background: `linear-gradient(90deg, ${sc.dot}, color-mix(in srgb, ${sc.dot} 65%, #000))` }} />
                        </div>
                      </div>
                    )}

                    {/* Key Results — refined rows */}
                    {okr.key_results.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {okr.key_results.map(kr => (
                          <div
                            key={kr.id}
                            className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                            style={{
                              borderColor: 'var(--theme-border)',
                              background: 'color-mix(in srgb, var(--theme-muted) 5%, var(--theme-card))',
                            }}
                          >
                            <div className="w-20 shrink-0">
                              <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--theme-border)' }}>
                                <div className="h-full rounded-full" style={{ width: `${kr.progress}%`, background: sc.dot }} />
                              </div>
                            </div>
                            <span className="flex-1 truncate text-[11px] text-[var(--theme-text)]">{kr.description}</span>
                            <span className="shrink-0 text-[10px] tabular-nums text-[var(--theme-muted)]">{kr.current} / {kr.target}</span>
                            <span className="shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: sc.text }}>{kr.progress}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Decisions ── */}
        {tab === 'decisions' && (
          decisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={JusticeScale01Icon} size={22} />
              </span>
              <p className="text-[14px] font-semibold text-[var(--theme-text)]">No decisions logged</p>
              <p className="text-[12px] text-[var(--theme-muted)]">Record key business decisions with context and rationale so you can look back later.</p>
              <button onClick={() => setDecisionModal('new')} className={`${primaryBtnCls} mt-2`} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={13} /> Log first decision
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {decisions.map(d => {
                const imp = IMPACT_COLORS[d.impact]
                return (
                  <div key={d.id} className="group rounded-2xl border p-4 transition-all hover:-translate-y-px hover:shadow-md" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <GradientChip icon={JusticeScale01Icon} color="#8b5cf6" size={9} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: imp.bg, color: imp.text }}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: imp.text }} />
                              {d.impact} impact
                            </span>
                            <span className="text-[11px] text-[var(--theme-muted)]">{DECISION_STATUS_LABELS[d.status]}</span>
                            {d.owner && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--theme-muted)]">
                                <HugeiconsIcon icon={UserIcon} size={11} /> {d.owner}
                              </span>
                            )}
                            <span className="text-[10px] tabular-nums text-[var(--theme-muted)]">{new Date(d.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[13px] font-semibold text-[var(--theme-text)]">{d.title}</p>
                          {d.decision && <p className="mt-1 line-clamp-2 text-[12px] text-[var(--theme-muted)]">→ {d.decision}</p>}
                          {d.rationale && <p className="mt-0.5 line-clamp-1 text-[11px] italic text-[var(--theme-muted)]">{d.rationale}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button onClick={() => setDecisionModal(d)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]" style={{ color: 'var(--theme-muted)' }} title="Edit">
                          <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                        </button>
                        <button
                          onClick={() => deleteDecisionM.mutate(d.id)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: 'var(--theme-danger)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </ScreenShell>

      {okrModal && (
        <OkrModal
          initial={okrModal === 'new' ? null : okrModal}
          onSave={data => okrModal === 'new'
            ? createOkrM.mutate(data)
            : updateOkrM.mutate({ id: (okrModal as OkrRecord).id, patch: data })
          }
          onClose={() => setOkrModal(null)}
        />
      )}
      {decisionModal && (
        <DecisionModal
          initial={decisionModal === 'new' ? null : decisionModal}
          onSave={data => decisionModal === 'new'
            ? createDecisionM.mutate(data)
            : updateDecisionM.mutate({ id: (decisionModal as DecisionRecord).id, patch: data })
          }
          onClose={() => setDecisionModal(null)}
        />
      )}
    </>
  )
}
