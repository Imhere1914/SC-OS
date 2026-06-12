import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, ArrowDown01Icon, Cancel01Icon, Clock01Icon, Delete01Icon, FlowSquareIcon, PencilEdit02Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import {
  ACTION_EMOJIS, ACTION_LABELS, ACTION_TYPES, CONDITION_OPERATORS, OPERATOR_LABELS,
  TRIGGER_EMOJIS, TRIGGER_EVENTS, TRIGGER_LABELS,
  createAutomation, deleteAutomation, fetchAutomations, fetchRuns, updateAutomation,
  type ActionConfig, type AutomationInput, type AutomationRecord, type AutomationRun, type Condition,
  type ConditionOperator, type TriggerEvent, type ActionType,
} from '@/lib/automations-api'
import { AUTOMATION_RECIPES, RECIPE_CATEGORIES, SUGGESTED_AUTOMATIONS, type AutomationRecipe } from '@/lib/automation-recipes'

// ─── Design tokens (shared vocabulary with Payments / Payroll) ──────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const RUN_STATUS_COLORS: Record<string, string> = {
  success: '#10b981',
  partial: '#f59e0b',
  failed: '#ef4444',
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

// Modern pill switch (pure CSS)
function PillSwitch({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
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

// ─── Action editor component ────────────────────────────────────────────────

function ActionEditor({ action, onChange, onRemove }: {
  action: ActionConfig
  onChange: (a: ActionConfig) => void
  onRemove: () => void
}) {
  const inputCls = 'w-full rounded-lg border px-2.5 py-1.5 text-[12px] text-[var(--theme-text)] outline-none'
  const inputStyle = { borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }

  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{ACTION_EMOJIS[action.type]}</span>
          <select
            value={action.type}
            onChange={e => onChange({ type: e.target.value as ActionType })}
            className={inputCls}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {ACTION_TYPES.map(t => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
          </select>
        </div>
        <button onClick={onRemove} className="shrink-0 rounded-lg p-1 hover:bg-[var(--theme-hover)]" style={{ color: 'var(--theme-danger)' }}>
          <HugeiconsIcon icon={Delete01Icon} size={13} />
        </button>
      </div>

      {action.type === 'send_email' && (
        <div className="flex flex-col gap-1.5">
          <input value={action.to ?? 'contact'} onChange={e => onChange({ ...action, to: e.target.value })} placeholder="To: 'contact' or email address" className={inputCls} style={inputStyle} />
          <input value={action.subject ?? ''} onChange={e => onChange({ ...action, subject: e.target.value })} placeholder="Subject (use {{contact_name}} for variables)" className={inputCls} style={inputStyle} />
          <textarea value={action.body ?? ''} onChange={e => onChange({ ...action, body: e.target.value })} placeholder="Email body…" rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
        </div>
      )}
      {action.type === 'update_stage' && (
        <select value={action.stage ?? ''} onChange={e => onChange({ ...action, stage: e.target.value })} className={inputCls} style={inputStyle}>
          <option value="">Select stage…</option>
          {['lead', 'contacted', 'qualified', 'customer', 'lost'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {action.type === 'add_tag' && (
        <input value={action.tag ?? ''} onChange={e => onChange({ ...action, tag: e.target.value })} placeholder="Tag name" className={inputCls} style={inputStyle} />
      )}
      {action.type === 'create_task' && (
        <div className="flex gap-1.5">
          <input value={action.task_title ?? ''} onChange={e => onChange({ ...action, task_title: e.target.value })} placeholder="Task title (use {{contact_name}} etc.)" className={`${inputCls} flex-1`} style={inputStyle} />
          <select value={action.task_priority ?? 'medium'} onChange={e => onChange({ ...action, task_priority: e.target.value as 'high' | 'medium' | 'low' })} className={inputCls} style={{ ...inputStyle, width: '90px' }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      )}
      {action.type === 'send_notification' && (
        <input value={action.message ?? ''} onChange={e => onChange({ ...action, message: e.target.value })} placeholder="Notification message (use {{contact_name}} etc.)" className={inputCls} style={inputStyle} />
      )}
      {action.type === 'webhook' && (
        <div className="flex gap-1.5">
          <input value={action.url ?? ''} onChange={e => onChange({ ...action, url: e.target.value })} placeholder="https://…" className={`${inputCls} flex-1`} style={inputStyle} />
          <select value={action.method ?? 'POST'} onChange={e => onChange({ ...action, method: e.target.value as 'POST' | 'GET' })} className={inputCls} style={{ ...inputStyle, width: '70px' }}>
            <option>POST</option><option>GET</option>
          </select>
        </div>
      )}
    </div>
  )
}

// ─── Builder modal ──────────────────────────────────────────────────────────

function BuilderModal({ initial, onSave, onClose }: {
  initial?: AutomationRecord | null
  onSave: (input: AutomationInput) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [trigger, setTrigger] = useState<TriggerEvent>(initial?.trigger ?? 'new_contact')
  const [conditions, setConditions] = useState<Condition[]>(initial?.conditions ?? [])
  const [actions, setActions] = useState<ActionConfig[]>(initial?.actions ?? [{ type: 'send_notification', message: 'Automation triggered: {{contact_name}}' }])

  const inputCls = 'w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none'
  const inputStyle = { borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'var(--theme-accent)' },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = 'var(--theme-border)' },
  }

  const addCondition = () => setConditions(c => [...c, { field: 'stage', operator: 'equals', value: '' }])
  const addAction = () => setActions(a => [...a, { type: 'send_notification', message: '' }])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border shadow-2xl" style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)' }}>

        {/* Header — gradient icon chip + bold title + muted subtitle */}
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={FlowSquareIcon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">
              {initial ? 'Edit automation' : 'New automation'}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">When a trigger fires → check conditions → run actions</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {/* Name + description */}
          <div className="flex flex-col gap-2.5">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Automation name…" className={inputCls} style={inputStyle} {...focusHandlers} />
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className={inputCls} style={inputStyle} {...focusHandlers} />
          </div>

          {/* ── WHEN ─────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--theme-accent)' }}>1</span>
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">When</span>
            </div>
            <div className="rounded-xl border p-3" style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
              <div className="flex flex-wrap gap-2">
                {TRIGGER_EVENTS.map(ev => (
                  <button
                    key={ev}
                    onClick={() => setTrigger(ev)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
                    style={trigger === ev
                      ? { background: 'var(--theme-accent)', color: 'white' }
                      : { background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-muted)' }
                    }
                  >
                    <span>{TRIGGER_EMOJIS[ev]}</span>
                    {TRIGGER_LABELS[ev]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── IF ───────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--theme-accent)' }}>2</span>
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">If (conditions — all must match)</span>
              </div>
              <button onClick={addCondition} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--theme-accent)' }}>
                <HugeiconsIcon icon={Add01Icon} size={13} /> Add condition
              </button>
            </div>
            {conditions.length === 0 ? (
              <p className="rounded-xl border border-dashed py-3 text-center text-[12px] text-[var(--theme-muted)]" style={{ borderColor: 'var(--theme-border)' }}>
                No conditions — automation runs on every trigger
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {conditions.map((cond, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select value={cond.field} onChange={e => setConditions(cs => cs.map((c, j) => j === i ? { ...c, field: e.target.value } : c))}
                      className="rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)', color: 'var(--theme-text)', width: '110px' }}>
                      {['stage', 'source', 'name', 'email', 'tags'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => setConditions(cs => cs.map((c, j) => j === i ? { ...c, operator: e.target.value as ConditionOperator } : c))}
                      className="rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)', color: 'var(--theme-text)', width: '140px' }}>
                      {CONDITION_OPERATORS.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
                    </select>
                    {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                      <input value={cond.value} onChange={e => setConditions(cs => cs.map((c, j) => j === i ? { ...c, value: e.target.value } : c))}
                        placeholder="value…" className="flex-1 rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)', color: 'var(--theme-text)' }} />
                    )}
                    <button onClick={() => setConditions(cs => cs.filter((_, j) => j !== i))} className="rounded-lg p-1 hover:bg-[var(--theme-hover)]" style={{ color: 'var(--theme-danger)' }}>
                      <HugeiconsIcon icon={Delete01Icon} size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── THEN ─────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--theme-accent)' }}>3</span>
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Then (actions — run in order)</span>
              </div>
              <button onClick={addAction} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--theme-accent)' }}>
                <HugeiconsIcon icon={Add01Icon} size={13} /> Add action
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {actions.map((action, i) => (
                <ActionEditor
                  key={i}
                  action={action}
                  onChange={a => setActions(as => as.map((x, j) => j === i ? a : x))}
                  onRemove={() => setActions(as => as.filter((_, j) => j !== i))}
                />
              ))}
              {actions.length === 0 && (
                <p className="rounded-xl border border-dashed py-3 text-center text-[12px] text-[var(--theme-muted)]" style={{ borderColor: 'var(--theme-border)' }}>
                  Add at least one action
                </p>
              )}
            </div>
          </section>

          {/* Variables hint */}
          <p className="text-[11px] text-[var(--theme-muted)]">
            💡 Use <code className="rounded bg-[var(--theme-hover)] px-1 py-0.5">{'{{contact_name}}'}</code> <code className="rounded bg-[var(--theme-hover)] px-1 py-0.5">{'{{contact_email}}'}</code> <code className="rounded bg-[var(--theme-hover)] px-1 py-0.5">{'{{contact_stage}}'}</code> in text fields.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)]" style={{ borderColor: 'var(--theme-border)' }}>Cancel</button>
          <button
            onClick={() => {
              if (!name.trim()) { toast('Name is required', { type: 'error' }); return }
              if (actions.length === 0) { toast('Add at least one action', { type: 'error' }); return }
              onSave({ name, description, trigger, conditions, actions })
            }}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            {initial ? 'Save changes' : 'Create automation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

// ─── Recipe card ────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onImport, imported, importing }: {
  recipe: AutomationRecipe
  onImport: (r: AutomationRecipe) => void
  imported: boolean
  importing: boolean
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px]"
        style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        {recipe.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--theme-text)]">{recipe.name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{recipe.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
            {TRIGGER_EMOJIS[recipe.trigger]} {TRIGGER_LABELS[recipe.trigger]}
          </span>
          <span className="text-[10px] tabular-nums text-[var(--theme-muted)]">→ {recipe.actions.length} action{recipe.actions.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button
        onClick={() => !imported && !importing && onImport(recipe)}
        disabled={imported || importing}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150',
          imported
            ? 'text-[var(--theme-success)]'
            : 'text-white hover:-translate-y-px hover:shadow-md',
        )}
        style={imported
          ? { background: 'color-mix(in srgb, var(--theme-success) 10%, transparent)' }
          : { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        <HugeiconsIcon icon={imported ? Tick02Icon : ArrowDown01Icon} size={11} />
        {importing ? 'Adding…' : imported ? 'Added' : 'Use'}
      </button>
    </div>
  )
}

export function AutomationsScreen() {
  const qc = useQueryClient()
  const [topTab, setTopTab] = useState<'automations' | 'recipes'>('automations')
  const [modal, setModal] = useState<'create' | AutomationRecord | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set())
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: fetchAutomations,
  })

  const create = useMutation({
    mutationFn: (input: AutomationInput) => createAutomation(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); setModal(null); toast('Automation created') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateAutomation>[1] }) => updateAutomation(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); setModal(null); toast('Saved') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })

  const importRecipe = (recipe: AutomationRecipe) => {
    if (importingIds.has(recipe.id) || importedIds.has(recipe.id)) return
    setImportingIds(prev => new Set([...prev, recipe.id]))
    const { id: _id, emoji: _e, category: _c, description: _d, ...input } = recipe
    create.mutate(input as AutomationInput, {
      onSuccess: () => {
        setImportingIds(prev => { const s = new Set(prev); s.delete(recipe.id); return s })
        setImportedIds(prev => new Set([...prev, recipe.id]))
        toast(`"${recipe.name}" added to your automations`)
        setTopTab('automations')
      },
      onError: () => {
        setImportingIds(prev => { const s = new Set(prev); s.delete(recipe.id); return s })
      },
    })
  }

  const enabled = automations.filter(a => a.enabled)
  const disabled = automations.filter(a => !a.enabled)

  const runsQuery = useQuery({
    queryKey: ['automation-runs'],
    queryFn: () => fetchRuns(),
    enabled: showHistory,
    staleTime: 30_000,
  })

  return (
    <>
      <ScreenShell
        icon={FlowSquareIcon}
        title="Automations"
        count={automations.length}
        subtitle="IF trigger → check conditions → run actions"
        action={
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] p-0.5">
              {(['automations', 'recipes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTopTab(tab)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                    topTab === tab ? 'text-white' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={topTab === tab ? { background: 'var(--theme-accent)' } : undefined}
                >
                  {tab === 'automations' ? 'My Automations' : '⚡ Recipes'}
                </button>
              ))}
            </div>
            {topTab === 'automations' && (
              <>
                <button
                  onClick={() => setShowHistory(h => !h)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors',
                    showHistory
                      ? 'text-white'
                      : 'border border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                  )}
                  style={showHistory ? { background: 'var(--theme-accent)' } : undefined}
                >
                  <HugeiconsIcon icon={Clock01Icon} size={14} />
                  History
                </button>
                <button onClick={() => setModal('create')} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md" style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
                  <HugeiconsIcon icon={Add01Icon} size={15} />
                  New
                </button>
              </>
            )}
          </div>
        }
      >
        {/* ── Recipes tab ── */}
        {topTab === 'recipes' && (
          <div className="flex flex-col gap-6">
            {/* Suggested Automations */}
            <section>
              <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
                <span>⚡</span>
                Suggested for You
              </h2>
              <div className="mb-1 rounded-xl border px-4 py-2.5 text-[11px] text-[var(--theme-muted)]" style={{ background: 'var(--theme-accent-soft)', borderColor: 'var(--theme-border)' }}>
                These four automations cover the most common cross-module workflows. Enable them with one click.
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {SUGGESTED_AUTOMATIONS.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    imported={importedIds.has(recipe.id)}
                    importing={importingIds.has(recipe.id)}
                    onImport={importRecipe}
                  />
                ))}
              </div>
            </section>
            {(Object.entries(RECIPE_CATEGORIES) as [AutomationRecipe['category'], { label: string; emoji: string }][]).map(([cat, meta]) => {
              const recipes = AUTOMATION_RECIPES.filter(r => r.category === cat)
              return (
                <section key={cat}>
                  <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
                    <span>{meta.emoji}</span>
                    {meta.label}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {recipes.map(recipe => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        imported={importedIds.has(recipe.id)}
                        importing={importingIds.has(recipe.id)}
                        onImport={importRecipe}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* ── My Automations tab ── */}
        {topTab === 'automations' && isLoading ? (
          <p className="py-12 text-center text-[13px] text-[var(--theme-muted)]">Loading…</p>
        ) : topTab === 'automations' && automations.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-20 text-center" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[36px]">⚡</p>
            <p className="mt-2 text-[14px] font-medium text-[var(--theme-text)]">No automations yet</p>
            <p className="mt-1 text-[13px] text-[var(--theme-muted)]">Create your first rule or import a recipe to get started.</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setModal('create')} className="text-[13px] font-medium" style={{ color: 'var(--theme-accent)' }}>
                Build from scratch →
              </button>
              <span className="text-[var(--theme-muted)]">or</span>
              <button onClick={() => setTopTab('recipes')} className="text-[13px] font-medium" style={{ color: 'var(--theme-accent)' }}>
                Browse recipes →
              </button>
            </div>
          </div>
        ) : topTab === 'automations' ? (
          <div className="flex flex-col gap-5">
            {[{ label: 'Active', items: enabled }, { label: 'Paused', items: disabled }]
              .filter(g => g.items.length > 0)
              .map(group => (
                <section key={group.label}>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">{group.label}</h2>
                  <div className="flex flex-col gap-2">
                    {group.items.map(auto => (
                      <div
                        key={auto.id}
                        className="group flex items-start gap-4 rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(12px)' }}
                      >
                        {/* Trigger badge */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
                          style={auto.enabled
                            ? { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }
                            : { background: 'var(--theme-hover)' }}
                        >
                          {TRIGGER_EMOJIS[auto.trigger]}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[var(--theme-text)]">{auto.name}</span>
                            {auto.run_count > 0 && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                                style={{
                                  background: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))',
                                  color: '#3b82f6',
                                  border: '1px solid color-mix(in srgb, #3b82f6 25%, transparent)',
                                }}
                              >
                                {auto.run_count} runs
                              </span>
                            )}
                          </div>
                          {auto.description && (
                            <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">{auto.description}</p>
                          )}
                          {/* Trigger → action visual chain */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-muted)]">
                            <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
                              {TRIGGER_EMOJIS[auto.trigger]} {TRIGGER_LABELS[auto.trigger]}
                            </span>
                            {auto.conditions.length > 0 && <span className="tabular-nums">· {auto.conditions.length} condition{auto.conditions.length > 1 ? 's' : ''}</span>}
                            <span>→</span>
                            {auto.actions.map((a, i) => (
                              <span
                                key={i}
                                className="rounded-full px-2 py-0.5 font-medium"
                                style={{
                                  background: 'color-mix(in srgb, #8b5cf6 10%, var(--theme-card))',
                                  color: '#8b5cf6',
                                  border: '1px solid color-mix(in srgb, #8b5cf6 25%, transparent)',
                                }}
                              >
                                {ACTION_EMOJIS[a.type]} {ACTION_LABELS[a.type]}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex shrink-0 items-center gap-2">
                          {/* Enable/disable pill switch */}
                          <PillSwitch
                            checked={auto.enabled}
                            onToggle={() => update.mutate({ id: auto.id, patch: { enabled: !auto.enabled } })}
                            label={auto.enabled ? 'Pause' : 'Enable'}
                          />
                          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              onClick={() => setModal(auto)}
                              className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                            >
                              <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
                            </button>
                            <button
                              onClick={() => remove.mutate(auto.id)}
                              className="rounded-lg p-1.5 transition-all duration-150"
                              style={{
                                color: '#ef4444',
                                background: 'color-mix(in srgb, #ef4444 8%, transparent)',
                                border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)',
                              }}
                            >
                              <HugeiconsIcon icon={Delete01Icon} size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        ) : null}
        {/* ── Run history panel ── */}
        {showHistory && (
          <section className="mt-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
                Run History
              </h2>
              <button onClick={() => setShowHistory(false)} className="rounded-lg p-1 hover:bg-[var(--theme-hover)]">
                <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-[var(--theme-muted)]" />
              </button>
            </div>
            {runsQuery.isLoading ? (
              <p className="py-6 text-center text-xs text-[var(--theme-muted)]">Loading runs…</p>
            ) : (runsQuery.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--theme-border)] py-8 text-center">
                <p className="text-sm text-[var(--theme-muted)]">No runs yet — trigger an automation to see history here.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] divide-y divide-[var(--theme-border)]" style={{ backdropFilter: 'blur(10px)' }}>
                {(runsQuery.data ?? []).map((run: AutomationRun) => {
                  const statusColor = RUN_STATUS_COLORS[run.status] ?? '#94a3b8'
                  return (
                    <div key={run.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--theme-hover)]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: statusColor, boxShadow: `0 0 6px color-mix(in srgb, ${statusColor} 60%, transparent)` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[var(--theme-text)]">{run.automation_name}</p>
                        <p className="truncate text-[10px] text-[var(--theme-muted)]">{run.context_summary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-medium tabular-nums" style={{ color: statusColor }}>
                          {run.actions_run} action{run.actions_run !== 1 ? 's' : ''}
                          {run.actions_failed > 0 && ` · ${run.actions_failed} failed`}
                        </p>
                        <p className="text-[10px] text-[var(--theme-muted)]" title={new Date(run.ran_at).toLocaleString()}>
                          {timeAgo(run.ran_at)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--theme-border)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--theme-muted)]">
                        {TRIGGER_EMOJIS[run.trigger]} {run.trigger.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </ScreenShell>

      {modal && (
        <BuilderModal
          initial={modal === 'create' ? null : modal}
          onSave={input =>
            modal === 'create'
              ? create.mutate(input)
              : update.mutate({ id: (modal as AutomationRecord).id, patch: input })
          }
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
