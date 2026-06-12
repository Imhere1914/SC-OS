import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AlertCircleIcon,
  Award01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  EyeIcon,
  Fire03Icon,
  FlashIcon,
  Idea01Icon,
  MessageEdit01Icon,
  MinusSignIcon,
  PencilEdit02Icon,
  Quiz03Icon,
  Rocket01Icon,
  SparklesIcon,
  StarIcon,
  Tick02Icon,
  ToggleOffIcon,
  ToggleOnIcon,
  UserGroupIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  HelpCircleIcon,
  LeftToRightListBulletIcon,
  Leaf01Icon,
  PauseIcon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

// ── Types (mirror server/stores/wellness-store.ts) ──────────────────────────────

type CardType = 'teach' | 'list' | 'quiz' | 'truefalse' | 'reflect' | 'tip' | 'complete'

interface WellnessCard {
  id: string
  type: CardType
  heading?: string; body?: string; image_url?: string
  key_points?: string[]
  intro?: string; variant?: 'good' | 'avoid' | 'neutral'; items?: string[]
  question?: string; options?: string[]; correct_index?: number; explanation?: string
  statement?: string; is_true?: boolean
  prompt?: string; placeholder?: string
  habit?: string; takeaway?: string; affirmation?: string
}

interface WellnessCategory { key: string; name: string; tagline: string; emoji: string; color: string; order: number }

interface WellnessSession {
  id: string; category_key: string
  title: string; subtitle: string; order: number
  est_minutes: number; points: number
  status: 'draft' | 'published'
  cards: WellnessCard[]
}

interface WellnessStats {
  total_sessions: number
  published_sessions: number
  draft_sessions: number
  sessions_by_category: Record<string, { total: number; published: number }>
  active_patients: number
  avg_streak: number
}

// ── Design tokens ───────────────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const ghostBtnCls = 'flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-all hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]'

const CARD_TYPE_META: Record<CardType, { label: string; color: string; icon: typeof BookOpen01Icon }> = {
  teach: { label: 'Teach', color: '#3b82f6', icon: BookOpen01Icon },
  list: { label: 'List', color: '#14b8a6', icon: LeftToRightListBulletIcon },
  quiz: { label: 'Quiz', color: '#8b5cf6', icon: Quiz03Icon },
  truefalse: { label: 'True / False', color: '#0ea5e9', icon: HelpCircleIcon },
  reflect: { label: 'Reflect', color: '#ec4899', icon: MessageEdit01Icon },
  tip: { label: 'Tip', color: '#f59e0b', icon: Idea01Icon },
  complete: { label: 'Complete', color: '#10b981', icon: CheckmarkCircle01Icon },
}

const CARD_TYPE_ORDER: CardType[] = ['teach', 'list', 'quiz', 'truefalse', 'reflect', 'tip', 'complete']

const LIST_VARIANT_META: Record<'good' | 'avoid' | 'neutral', { label: string; color: string; icon: typeof BookOpen01Icon }> = {
  good: { label: 'Embrace', color: '#10b981', icon: Leaf01Icon },
  avoid: { label: 'Limit', color: '#f59e0b', icon: PauseIcon },
  neutral: { label: 'Neutral', color: '#3b82f6', icon: LeftToRightListBulletIcon },
}

// ── API helpers ─────────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<WellnessCategory[]> {
  const res = await fetch('/api/wellness/categories')
  if (!res.ok) throw new Error('Failed to load categories')
  const d = (await res.json()) as { categories: WellnessCategory[] }
  return d.categories
}

async function fetchSessions(brand: string): Promise<WellnessSession[]> {
  const res = await fetch(`/api/wellness/admin/sessions?brand=${brand}`)
  if (!res.ok) throw new Error('Failed to load sessions')
  const d = (await res.json()) as { sessions: WellnessSession[] }
  return d.sessions
}

async function fetchStats(brand: string): Promise<WellnessStats> {
  const res = await fetch(`/api/wellness/admin/stats?brand=${brand}`)
  if (!res.ok) throw new Error('Failed to load stats')
  const d = (await res.json()) as { stats: WellnessStats }
  return d.stats
}

// ── Stat card ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: typeof StarIcon
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// ── Status badge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  const color = status === 'published' ? '#10b981' : '#f59e0b'
  const label = status === 'published' ? 'Published' : 'Draft'
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
      {label}
    </span>
  )
}

function Chip({ icon, children, color }: { icon: typeof StarIcon; children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
      style={{
        borderColor: 'var(--theme-border)',
        color: color ?? 'var(--theme-muted)',
        background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)',
      }}
    >
      <HugeiconsIcon icon={icon} size={11} />
      {children}
    </span>
  )
}

// ── Modal shell ─────────────────────────────────────────────────────────────────

function Modal({ title, subtitle, icon, onClose, children, wide }: {
  title: string; subtitle?: string; icon: typeof StarIcon
  onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className={cn('my-8 w-full rounded-2xl border shadow-2xl', wide ? 'max-w-2xl' : 'max-w-lg')}
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
            <HugeiconsIcon icon={icon} size={17} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const fieldLabelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'
const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

// ── Session edit / create modal ─────────────────────────────────────────────────

interface SessionFormState {
  title: string; subtitle: string; category_key: string
  order: number; est_minutes: number; points: number
}

function SessionFormModal({ session, categories, onClose, onSave }: {
  session: WellnessSession | null
  categories: WellnessCategory[]
  onClose: () => void
  onSave: (data: SessionFormState) => void
}) {
  const [form, setForm] = useState<SessionFormState>({
    title: session?.title ?? '',
    subtitle: session?.subtitle ?? '',
    category_key: session?.category_key ?? categories[0]?.key ?? '',
    order: session?.order ?? 0,
    est_minutes: session?.est_minutes ?? 6,
    points: session?.points ?? 50,
  })
  const set = <K extends keyof SessionFormState>(k: K, v: SessionFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal
      title={session ? 'Edit Session' : 'New Session'}
      subtitle={session ? session.title : 'Create a new daily wellness session'}
      icon={session ? PencilEdit02Icon : Add01Icon}
      onClose={onClose}
    >
      <div className="space-y-3 p-4">
        <div>
          <label className={fieldLabelCls}>Title</label>
          <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. The Cortisol Curve" />
        </div>
        <div>
          <label className={fieldLabelCls}>Subtitle</label>
          <input className={inputCls} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="A short hook for patients" />
        </div>
        <div>
          <label className={fieldLabelCls}>Category</label>
          <select className={inputCls} value={form.category_key} onChange={e => set('category_key', e.target.value)}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={fieldLabelCls}>Order</label>
            <input type="number" className={inputCls} value={form.order} onChange={e => set('order', Number(e.target.value))} />
          </div>
          <div>
            <label className={fieldLabelCls}>Minutes</label>
            <input type="number" className={inputCls} value={form.est_minutes} onChange={e => set('est_minutes', Number(e.target.value))} />
          </div>
          <div>
            <label className={fieldLabelCls}>Points</label>
            <input type="number" className={inputCls} value={form.points} onChange={e => set('points', Number(e.target.value))} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <button onClick={onClose} className={ghostBtnCls}>Cancel</button>
        <button
          onClick={() => { if (!form.title.trim()) { toast('Title is required', { type: 'error' }); return } onSave(form) }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} />
          {session ? 'Save Changes' : 'Create Session'}
        </button>
      </div>
    </Modal>
  )
}

// ── Preview modal — renders the session's cards as a patient would read them ─────

function PreviewCard({ card, categoryColor }: { card: WellnessCard; categoryColor: string }) {
  const meta = CARD_TYPE_META[card.type]
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
        >
          <HugeiconsIcon icon={meta.icon} size={10} />
          {meta.label}
        </span>
      </div>

      {card.type === 'teach' && (
        <div>
          {card.image_url && <img src={card.image_url} alt="" className="mb-3 w-full rounded-lg object-cover" style={{ maxHeight: 180 }} />}
          {card.heading && <h3 className="mb-1.5 text-[15px] font-bold text-[var(--theme-text)]">{card.heading}</h3>}
          {card.body && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--theme-muted)]">{card.body}</p>}
          {(card.key_points ?? []).filter(p => p.trim()).length > 0 && (
            <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--theme-border)', background: `color-mix(in srgb, ${categoryColor} 6%, transparent)` }}>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: categoryColor }}>Key takeaways</p>
              <ul className="space-y-1.5">
                {(card.key_points ?? []).filter(p => p.trim()).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--theme-muted)]">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} className="mt-px shrink-0" style={{ color: categoryColor }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {card.type === 'list' && (() => {
        const vmeta = LIST_VARIANT_META[card.variant ?? 'neutral']
        const items = (card.items ?? []).filter(i => i.trim())
        return (
          <div>
            {card.heading && <h3 className="mb-1 text-[15px] font-bold text-[var(--theme-text)]">{card.heading}</h3>}
            {card.intro && <p className="mb-2.5 text-[13px] leading-relaxed text-[var(--theme-muted)]">{card.intro}</p>}
            <span
              className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: `color-mix(in srgb, ${vmeta.color} 14%, transparent)`, color: vmeta.color }}
            >
              <HugeiconsIcon icon={vmeta.icon} size={10} /> {vmeta.label}
            </span>
            <ul className="space-y-1.5">
              {items.map((item, i) => {
                const dash = item.indexOf(' — ')
                const name = dash >= 0 ? item.slice(0, dash) : item
                const why = dash >= 0 ? item.slice(dash + 3) : ''
                return (
                  <li key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>
                    <HugeiconsIcon icon={vmeta.icon} size={14} className="mt-0.5 shrink-0" style={{ color: vmeta.color }} />
                    <span className="text-[var(--theme-muted)]">
                      <span className="font-semibold text-[var(--theme-text)]">{name}</span>
                      {why && <span> — {why}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })()}

      {card.type === 'quiz' && (
        <div>
          {card.question && <h3 className="mb-2.5 text-[14px] font-semibold text-[var(--theme-text)]">{card.question}</h3>}
          <div className="space-y-1.5">
            {(card.options ?? []).map((opt, i) => {
              const correct = i === card.correct_index
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]"
                  style={{
                    borderColor: correct ? 'color-mix(in srgb, #10b981 40%, transparent)' : 'var(--theme-border)',
                    background: correct ? 'color-mix(in srgb, #10b981 10%, transparent)' : 'transparent',
                    color: correct ? '#10b981' : 'var(--theme-muted)',
                  }}
                >
                  {correct
                    ? <HugeiconsIcon icon={CheckmarkCircle01Icon} size={15} />
                    : <span className="h-3.5 w-3.5 shrink-0 rounded-full border" style={{ borderColor: 'var(--theme-border)' }} />}
                  <span className={correct ? 'font-semibold' : ''}>{opt}</span>
                </div>
              )
            })}
          </div>
          {card.explanation && (
            <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ background: 'var(--theme-hover)', color: 'var(--theme-muted)' }}>
              {card.explanation}
            </p>
          )}
        </div>
      )}

      {card.type === 'truefalse' && (
        <div>
          {card.statement && <h3 className="mb-2.5 text-[14px] font-semibold text-[var(--theme-text)]">{card.statement}</h3>}
          <div className="flex gap-2">
            {([true, false] as const).map(val => {
              const isAnswer = card.is_true === val
              const color = val ? '#10b981' : '#ef4444'
              return (
                <span
                  key={String(val)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    borderColor: isAnswer ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--theme-border)',
                    background: isAnswer ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
                    color: isAnswer ? color : 'var(--theme-muted)',
                  }}
                >
                  {isAnswer && <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} />}
                  {val ? 'True' : 'False'}
                </span>
              )
            })}
          </div>
          {card.explanation && (
            <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ background: 'var(--theme-hover)', color: 'var(--theme-muted)' }}>
              {card.explanation}
            </p>
          )}
        </div>
      )}

      {card.type === 'reflect' && (
        <div>
          {card.prompt && <h3 className="mb-2 text-[14px] font-semibold text-[var(--theme-text)]">{card.prompt}</h3>}
          <div
            className="rounded-lg border border-dashed px-3 py-3 text-[12px] italic"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}
          >
            {card.placeholder || 'Patient writes their reflection here…'}
          </div>
        </div>
      )}

      {card.type === 'tip' && (
        <div>
          {card.heading && <h3 className="mb-1.5 text-[15px] font-bold text-[var(--theme-text)]">{card.heading}</h3>}
          {card.body && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--theme-muted)]">{card.body}</p>}
          {card.habit && (
            <div
              className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}
            >
              <HugeiconsIcon icon={FlashIcon} size={14} className="mt-px shrink-0" />
              <span>{card.habit}</span>
            </div>
          )}
        </div>
      )}

      {card.type === 'complete' && (
        <div className="text-center">
          <span
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: `linear-gradient(135deg, ${categoryColor}, color-mix(in srgb, ${categoryColor} 60%, #000))` }}
          >
            <HugeiconsIcon icon={Rocket01Icon} size={22} className="text-white" />
          </span>
          {card.takeaway && <p className="mb-2 text-[14px] font-semibold text-[var(--theme-text)]">{card.takeaway}</p>}
          {card.affirmation && <p className="text-[13px] italic leading-relaxed text-[var(--theme-muted)]">“{card.affirmation}”</p>}
        </div>
      )}
    </div>
  )
}

function PreviewModal({ session, category, onClose }: {
  session: WellnessSession; category?: WellnessCategory; onClose: () => void
}) {
  const color = category?.color ?? '#a3843b'
  return (
    <Modal title={session.title} subtitle={`Preview — ${session.cards.length} cards as patients see them`} icon={EyeIcon} onClose={onClose} wide>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--theme-border)', background: `color-mix(in srgb, ${color} 8%, var(--theme-card))` }}>
          <div className="flex items-center gap-2">
            <span className="text-[22px]">{category?.emoji}</span>
            <div>
              <p className="text-[15px] font-bold text-[var(--theme-text)]">{session.title}</p>
              {session.subtitle && <p className="text-[12px] text-[var(--theme-muted)]">{session.subtitle}</p>}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip icon={Clock01Icon}>{session.est_minutes} min</Chip>
            <Chip icon={StarIcon}>{session.points} pts</Chip>
            <Chip icon={BookOpen01Icon}>{session.cards.length} cards</Chip>
          </div>
        </div>
        {session.cards.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--theme-muted)]">No cards yet. Add cards to preview this session.</div>
        ) : (
          session.cards.map(card => <PreviewCard key={card.id} card={card} categoryColor={color} />)
        )}
      </div>
      <div className="flex justify-end border-t p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <button onClick={onClose} className={primaryBtnCls} style={primaryBtnStyle}>Done</button>
      </div>
    </Modal>
  )
}

// ── Card editor forms (per type) ────────────────────────────────────────────────

function StringListEditor({ label, values, onChange, placeholder, reorderable }: {
  label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string; reorderable?: boolean
}) {
  const set = (i: number, v: string) => onChange(values.map((x, idx) => idx === i ? v : x))
  const add = () => onChange([...values, ''])
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= values.length) return
    const next = [...values]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={cn(fieldLabelCls, 'mb-0')}>{label}</label>
        <button onClick={add} className="text-[11px] font-semibold text-[var(--theme-accent)] hover:underline">+ Add</button>
      </div>
      <div className="space-y-1.5">
        {values.length === 0 && <p className="text-[11px] italic text-[var(--theme-muted)]">None yet — tap “+ Add”.</p>}
        {values.map((val, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {reorderable && (
              <div className="flex shrink-0 flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[var(--theme-muted)] hover:text-[var(--theme-accent)] disabled:opacity-30">
                  <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === values.length - 1} className="text-[var(--theme-muted)] hover:text-[var(--theme-accent)] disabled:opacity-30">
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                </button>
              </div>
            )}
            <input className={cn(inputCls, 'py-1.5')} value={val} onChange={e => set(i, e.target.value)} placeholder={placeholder} />
            <button onClick={() => remove(i)} className="rounded-lg p-1 text-[var(--theme-muted)] hover:text-[#ef4444]">
              <HugeiconsIcon icon={MinusSignIcon} size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CardEditorForm({ card, onChange }: { card: WellnessCard; onChange: (patch: Partial<WellnessCard>) => void }) {
  if (card.type === 'teach' || card.type === 'tip') {
    return (
      <div className="space-y-3">
        <div>
          <label className={fieldLabelCls}>Heading</label>
          <input className={inputCls} value={card.heading ?? ''} onChange={e => onChange({ heading: e.target.value })} />
        </div>
        <div>
          <label className={fieldLabelCls}>Body</label>
          <textarea className={cn(inputCls, 'min-h-[100px] resize-y')} value={card.body ?? ''} onChange={e => onChange({ body: e.target.value })} />
        </div>
        {card.type === 'teach' && (
          <>
            <div>
              <label className={fieldLabelCls}>Image URL (optional)</label>
              <input className={inputCls} value={card.image_url ?? ''} onChange={e => onChange({ image_url: e.target.value })} placeholder="https://…" />
            </div>
            <StringListEditor
              label="Key takeaways (optional)"
              values={card.key_points ?? []}
              onChange={key_points => onChange({ key_points })}
              placeholder="A bullet takeaway"
            />
          </>
        )}
        {card.type === 'tip' && (
          <div>
            <label className={fieldLabelCls}>Micro-habit (optional)</label>
            <input className={inputCls} value={card.habit ?? ''} onChange={e => onChange({ habit: e.target.value })} placeholder="A tiny actionable habit" />
          </div>
        )}
      </div>
    )
  }

  if (card.type === 'list') {
    return (
      <div className="space-y-3">
        <div>
          <label className={fieldLabelCls}>Heading</label>
          <input className={inputCls} value={card.heading ?? ''} onChange={e => onChange({ heading: e.target.value })} placeholder="e.g. Foods to embrace" />
        </div>
        <div>
          <label className={fieldLabelCls}>Intro (optional)</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.intro ?? ''} onChange={e => onChange({ intro: e.target.value })} placeholder="A sentence above the items" />
        </div>
        <div>
          <label className={fieldLabelCls}>Variant</label>
          <div className="flex gap-1.5">
            {(['good', 'avoid', 'neutral'] as const).map(v => {
              const vmeta = LIST_VARIANT_META[v]
              const active = (card.variant ?? 'neutral') === v
              return (
                <button
                  key={v}
                  onClick={() => onChange({ variant: v })}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    borderColor: active ? vmeta.color : 'var(--theme-border)',
                    background: active ? `color-mix(in srgb, ${vmeta.color} 12%, transparent)` : 'transparent',
                    color: active ? vmeta.color : 'var(--theme-muted)',
                  }}
                >
                  <HugeiconsIcon icon={vmeta.icon} size={14} /> {vmeta.label}
                </button>
              )
            })}
          </div>
        </div>
        <StringListEditor
          label='Items — each often "Name — short why"'
          values={card.items ?? []}
          onChange={items => onChange({ items })}
          placeholder="Spinach — rich in magnesium"
          reorderable
        />
      </div>
    )
  }

  if (card.type === 'quiz') {
    const options = card.options ?? []
    const setOpt = (i: number, v: string) => onChange({ options: options.map((o, idx) => idx === i ? v : o) })
    const addOpt = () => onChange({ options: [...options, ''] })
    const removeOpt = (i: number) => {
      const next = options.filter((_, idx) => idx !== i)
      const correct = card.correct_index ?? 0
      onChange({ options: next, correct_index: correct >= next.length ? Math.max(0, next.length - 1) : correct })
    }
    return (
      <div className="space-y-3">
        <div>
          <label className={fieldLabelCls}>Question</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.question ?? ''} onChange={e => onChange({ question: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={cn(fieldLabelCls, 'mb-0')}>Options — tap the dot to mark correct</label>
            <button onClick={addOpt} className="text-[11px] font-semibold text-[var(--theme-accent)] hover:underline">+ Add</button>
          </div>
          <div className="space-y-1.5">
            {options.map((opt, i) => {
              const correct = i === card.correct_index
              return (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() => onChange({ correct_index: i })}
                    title="Mark correct"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
                    style={{
                      borderColor: correct ? '#10b981' : 'var(--theme-border)',
                      background: correct ? '#10b981' : 'transparent',
                      color: 'white',
                    }}
                  >
                    {correct && <HugeiconsIcon icon={Tick02Icon} size={12} />}
                  </button>
                  <input className={cn(inputCls, 'py-1.5')} value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                  <button onClick={() => removeOpt(i)} className="rounded-lg p-1 text-[var(--theme-muted)] hover:text-[#ef4444]">
                    <HugeiconsIcon icon={MinusSignIcon} size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <label className={fieldLabelCls}>Explanation</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.explanation ?? ''} onChange={e => onChange({ explanation: e.target.value })} />
        </div>
      </div>
    )
  }

  if (card.type === 'truefalse') {
    return (
      <div className="space-y-3">
        <div>
          <label className={fieldLabelCls}>Statement</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.statement ?? ''} onChange={e => onChange({ statement: e.target.value })} />
        </div>
        <div>
          <label className={fieldLabelCls}>Correct answer</label>
          <button
            onClick={() => onChange({ is_true: !card.is_true })}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all"
            style={{ borderColor: 'var(--theme-border)', color: card.is_true ? '#10b981' : '#ef4444' }}
          >
            <HugeiconsIcon icon={card.is_true ? ToggleOnIcon : ToggleOffIcon} size={20} />
            {card.is_true ? 'True' : 'False'}
          </button>
        </div>
        <div>
          <label className={fieldLabelCls}>Explanation</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.explanation ?? ''} onChange={e => onChange({ explanation: e.target.value })} />
        </div>
      </div>
    )
  }

  if (card.type === 'reflect') {
    return (
      <div className="space-y-3">
        <div>
          <label className={fieldLabelCls}>Prompt</label>
          <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.prompt ?? ''} onChange={e => onChange({ prompt: e.target.value })} />
        </div>
        <div>
          <label className={fieldLabelCls}>Placeholder (optional)</label>
          <input className={inputCls} value={card.placeholder ?? ''} onChange={e => onChange({ placeholder: e.target.value })} />
        </div>
      </div>
    )
  }

  // complete
  return (
    <div className="space-y-3">
      <div>
        <label className={fieldLabelCls}>Takeaway</label>
        <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.takeaway ?? ''} onChange={e => onChange({ takeaway: e.target.value })} />
      </div>
      <div>
        <label className={fieldLabelCls}>Affirmation (optional)</label>
        <textarea className={cn(inputCls, 'min-h-[60px] resize-y')} value={card.affirmation ?? ''} onChange={e => onChange({ affirmation: e.target.value })} />
      </div>
    </div>
  )
}

// ── Card editor side sheet ──────────────────────────────────────────────────────

function CardsSheet({ session, brand, onClose, queryKey }: {
  session: WellnessSession; brand: string; onClose: () => void; queryKey: readonly unknown[]
}) {
  const qc = useQueryClient()
  const [cards, setCards] = useState<WellnessCard[]>(session.cards)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const addMut = useMutation({
    mutationFn: async (type: CardType) => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}/cards`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, type }),
      })
      if (!res.ok) throw new Error('Failed to add card')
      return (await res.json()) as { session: WellnessSession }
    },
    onSuccess: (d) => {
      setCards(d.session.cards); setAdding(false); invalidate()
      const last = d.session.cards[d.session.cards.length - 1]
      if (last) setEditingId(last.id)
    },
    onError: () => toast('Failed to add card', { type: 'error' }),
  })

  const saveMut = useMutation({
    mutationFn: async (card: WellnessCard) => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}/cards/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...card, brand }),
      })
      if (!res.ok) throw new Error('Failed to save card')
      return (await res.json()) as { session: WellnessSession }
    },
    onSuccess: (d) => { setCards(d.session.cards); invalidate(); toast('Card saved') },
    onError: () => toast('Failed to save card', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}/cards/${cardId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete card')
      return (await res.json()) as { session: WellnessSession }
    },
    onSuccess: (d) => {
      setCards(d.session.cards)
      setEditingId(prev => (prev && d.session.cards.find(c => c.id === prev)) ? prev : null)
      invalidate()
    },
    onError: () => toast('Failed to delete card', { type: 'error' }),
  })

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}/cards/reorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, ordered_ids: orderedIds }),
      })
      if (!res.ok) throw new Error('Failed to reorder')
      return (await res.json()) as { session: WellnessSession }
    },
    onSuccess: (d) => { setCards(d.session.cards); invalidate() },
    onError: () => toast('Failed to reorder', { type: 'error' }),
  })

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= cards.length) return
    const next = [...cards]
    ;[next[i], next[j]] = [next[j], next[i]]
    setCards(next)
    reorderMut.mutate(next.map(c => c.id))
  }

  const patchLocal = (id: string, patch: Partial<WellnessCard>) =>
    setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
            <HugeiconsIcon icon={BookOpen01Icon} size={17} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold leading-tight text-[var(--theme-text)]">Edit Cards</h2>
            <p className="truncate text-[12px] text-[var(--theme-muted)]">{session.title} · {cards.length} cards</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {cards.length === 0 && (
            <p className="py-8 text-center text-[13px] text-[var(--theme-muted)]">No cards yet. Add the first one below.</p>
          )}
          {cards.map((card, i) => {
            const meta = CARD_TYPE_META[card.type]
            const open = editingId === card.id
            return (
              <div key={card.id} className="rounded-xl border" style={{ borderColor: open ? 'var(--theme-accent)' : 'var(--theme-border)' }}>
                <div className="flex items-center gap-2 p-2.5">
                  <span className="text-[10px] font-bold tabular-nums text-[var(--theme-muted)]">{i + 1}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
                  >
                    <HugeiconsIcon icon={meta.icon} size={10} />
                    {meta.label}
                  </span>
                  <span className="ml-1 min-w-0 flex-1 truncate text-[12px] text-[var(--theme-muted)]">
                    {card.heading || card.question || card.statement || card.prompt || card.takeaway || '—'}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-[var(--theme-muted)] hover:text-[var(--theme-accent)] disabled:opacity-30">
                      <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === cards.length - 1} className="rounded p-1 text-[var(--theme-muted)] hover:text-[var(--theme-accent)] disabled:opacity-30">
                      <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                    </button>
                    <button onClick={() => setEditingId(open ? null : card.id)} className="rounded p-1 text-[var(--theme-muted)] hover:text-[var(--theme-accent)]">
                      <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                    </button>
                    <button onClick={() => deleteMut.mutate(card.id)} className="rounded p-1 text-[var(--theme-muted)] hover:text-[#ef4444]">
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="border-t p-3" style={{ borderColor: 'var(--theme-border)' }}>
                    <CardEditorForm card={card} onChange={patch => patchLocal(card.id, patch)} />
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => saveMut.mutate(card)} disabled={saveMut.isPending} className={primaryBtnCls} style={primaryBtnStyle}>
                        <HugeiconsIcon icon={Tick02Icon} size={14} /> Save Card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="border-t p-3" style={{ borderColor: 'var(--theme-border)' }}>
          {adding ? (
            <div>
              <p className={fieldLabelCls}>Pick a card type</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CARD_TYPE_ORDER.map(type => {
                  const meta = CARD_TYPE_META[type]
                  return (
                    <button
                      key={type}
                      onClick={() => addMut.mutate(type)}
                      className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium transition-all hover:border-[var(--theme-accent)]"
                      style={{ borderColor: 'var(--theme-border)', color: meta.color }}
                    >
                      <HugeiconsIcon icon={meta.icon} size={16} />
                      <span className="text-[var(--theme-muted)]">{meta.label}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setAdding(false)} className="mt-2 w-full text-center text-[11px] text-[var(--theme-muted)] hover:underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className={cn(primaryBtnCls, 'w-full justify-center')} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={14} /> Add Card
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Confirm delete dialog ───────────────────────────────────────────────────────

function ConfirmDelete({ session, onCancel, onConfirm }: {
  session: WellnessSession; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <Modal title="Delete session?" subtitle={session.title} icon={AlertCircleIcon} onClose={onCancel}>
      <div className="p-4">
        <p className="text-[13px] leading-relaxed text-[var(--theme-muted)]">
          This permanently removes “{session.title}” and all {session.cards.length} of its cards. This cannot be undone.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <button onClick={onCancel} className={ghostBtnCls}>Cancel</button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: '#ef4444' }}
        >
          <HugeiconsIcon icon={Delete01Icon} size={14} /> Delete
        </button>
      </div>
    </Modal>
  )
}

// ── Session card ────────────────────────────────────────────────────────────────

function SessionRow({ session, category, allCategories, brand, queryKey }: {
  session: WellnessSession; category?: WellnessCategory; allCategories: WellnessCategory[]
  brand: string; queryKey: readonly unknown[]
}) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState(false)
  const [editing, setEditing] = useState(false)
  const [cardsOpen, setCardsOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const color = category?.color ?? '#a3843b'

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const publishMut = useMutation({
    mutationFn: async () => {
      const action = session.status === 'published' ? 'unpublish' : 'publish'
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['wellness', 'admin', 'stats', brand] })
      toast(session.status === 'published' ? 'Unpublished — now a draft' : 'Published — live for patients')
    },
    onError: () => toast('Failed to update status', { type: 'error' }),
  })

  const editMut = useMutation({
    mutationFn: async (data: SessionFormState) => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { setEditing(false); invalidate(); toast('Session updated') },
    onError: () => toast('Failed to save', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wellness/admin/sessions/${session.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      setConfirmDel(false); invalidate()
      qc.invalidateQueries({ queryKey: ['wellness', 'admin', 'stats', brand] })
      toast('Session deleted')
    },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const publishing = session.status !== 'published'

  return (
    <>
      <div
        className="group rounded-xl border p-3.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums text-white"
            style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))` }}
          >
            {session.order + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold text-[var(--theme-text)]">{session.title}</h3>
              <StatusBadge status={session.status} />
            </div>
            {session.subtitle && <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">{session.subtitle}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip icon={Clock01Icon}>{session.est_minutes} min</Chip>
              <Chip icon={StarIcon}>{session.points} pts</Chip>
              <Chip icon={BookOpen01Icon}>{session.cards.length} cards</Chip>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={() => setPreview(true)} className={ghostBtnCls}>
            <HugeiconsIcon icon={EyeIcon} size={13} /> Preview
          </button>
          <button onClick={() => setEditing(true)} className={ghostBtnCls}>
            <HugeiconsIcon icon={PencilEdit02Icon} size={13} /> Edit
          </button>
          <button onClick={() => setCardsOpen(true)} className={ghostBtnCls}>
            <HugeiconsIcon icon={BookOpen01Icon} size={13} /> Edit Cards
          </button>
          <button
            onClick={() => publishMut.mutate()}
            disabled={publishMut.isPending}
            className={publishing ? primaryBtnCls : ghostBtnCls}
            style={publishing ? primaryBtnStyle : undefined}
          >
            <HugeiconsIcon icon={publishing ? Rocket01Icon : ToggleOffIcon} size={13} />
            {publishing ? 'Publish' : 'Unpublish'}
          </button>
          <button onClick={() => setConfirmDel(true)} className="ml-auto rounded-lg p-1.5 text-[var(--theme-muted)] opacity-0 transition-all hover:text-[#ef4444] focus-within:opacity-100 group-hover:opacity-100">
            <HugeiconsIcon icon={Delete01Icon} size={14} />
          </button>
        </div>
      </div>

      {preview && <PreviewModal session={session} category={category} onClose={() => setPreview(false)} />}
      {editing && (
        <SessionFormModal
          session={session}
          categories={allCategories}
          onClose={() => setEditing(false)}
          onSave={d => editMut.mutate(d)}
        />
      )}
      {cardsOpen && <CardsSheet session={session} brand={brand} queryKey={queryKey} onClose={() => setCardsOpen(false)} />}
      {confirmDel && <ConfirmDelete session={session} onCancel={() => setConfirmDel(false)} onConfirm={() => deleteMut.mutate()} />}
    </>
  )
}

// ── Skeletons ───────────────────────────────────────────────────────────────────

function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[110px] animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      ))}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[130px] animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      ))}
    </div>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'wellness-drafts-banner-dismissed'

export function WellnessAdminScreen() {
  const brand = useBrand()
  const [activeCat, setActiveCat] = useState<string>('all')
  const [creating, setCreating] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const qc = useQueryClient()

  const sessionsKey = ['wellness', 'admin', 'sessions', brand.id] as const

  const catsQuery = useQuery({ queryKey: ['wellness', 'categories'], queryFn: fetchCategories })
  const sessionsQuery = useQuery({ queryKey: sessionsKey, queryFn: () => fetchSessions(brand.id) })
  const statsQuery = useQuery({ queryKey: ['wellness', 'admin', 'stats', brand.id], queryFn: () => fetchStats(brand.id) })

  const categories = useMemo(() => catsQuery.data ?? [], [catsQuery.data])
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data])
  const stats = statsQuery.data

  const createMut = useMutation({
    mutationFn: async (data: SessionFormState) => {
      const res = await fetch('/api/wellness/admin/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brand.id }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      setCreating(false)
      qc.invalidateQueries({ queryKey: sessionsKey })
      qc.invalidateQueries({ queryKey: ['wellness', 'admin', 'stats', brand.id] })
      toast('Session created')
    },
    onError: () => toast('Failed to create session', { type: 'error' }),
  })

  const filtered = activeCat === 'all' ? sessions : sessions.filter(s => s.category_key === activeCat)

  // Group by category, preserving category order
  const grouped = useMemo(() => {
    const map = new Map<string, WellnessSession[]>()
    for (const s of filtered) {
      const arr = map.get(s.category_key) ?? []
      arr.push(s)
      map.set(s.category_key, arr)
    }
    return categories
      .filter(c => map.has(c.key))
      .map(c => ({ category: c, sessions: (map.get(c.key) ?? []).sort((a, b) => a.order - b.order) }))
  }, [filtered, categories])

  const allPublished = sessions.length > 0 && sessions.every(s => s.status === 'published')
  const showBanner = !bannerDismissed && !allPublished && sessions.some(s => s.status === 'draft')
  const dismissBanner = () => { localStorage.setItem(DISMISS_KEY, '1'); setBannerDismissed(true) }

  const loading = sessionsQuery.isLoading || catsQuery.isLoading

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
            <HugeiconsIcon icon={Fire03Icon} size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Daily Wellness</h1>
            <p className="text-[13px] text-[var(--theme-muted)]">Elevate-style daily program for patients</p>
          </div>
        </div>
        <button onClick={() => setCreating(true)} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={14} /> New Session
        </button>
      </div>

      {/* Drafts banner */}
      {showBanner && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border p-3.5"
          style={{ borderColor: 'color-mix(in srgb, #f59e0b 35%, transparent)', background: 'color-mix(in srgb, #f59e0b 8%, var(--theme-card))' }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, #f59e0b 18%, transparent)' }}>
            <HugeiconsIcon icon={AlertCircleIcon} size={15} style={{ color: '#f59e0b' }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">These sessions are drafts.</p>
            <p className="text-[12px] text-[var(--theme-muted)]">Review each one and Publish to make it available to patients.</p>
          </div>
          <button onClick={dismissBanner} className="rounded-lg p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={15} />
          </button>
        </div>
      )}

      {/* Stats */}
      {statsQuery.isLoading ? <SkeletonStats /> : stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Sessions" value={String(stats.total_sessions)} sub={`${stats.draft_sessions} drafts`} color="#a3843b" icon={BookOpen01Icon} />
          <StatCard label="Published" value={String(stats.published_sessions)} sub="live for patients" color="#10b981" icon={CheckmarkCircle01Icon} />
          <StatCard label="Categories" value={String(categories.length)} sub="wellness pillars" color="#8b5cf6" icon={SparklesIcon} />
          <StatCard
            label="Active Patients"
            value={String(stats.active_patients)}
            sub={stats.avg_streak > 0 ? `${stats.avg_streak} day avg streak` : 'avg streak —'}
            color="#f59e0b"
            icon={UserGroupIcon}
          />
        </div>
      )}

      {/* Category filter */}
      <div className="mb-4 mt-6 overflow-x-auto">
        <div className="inline-flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
          <button
            onClick={() => setActiveCat('all')}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all', activeCat === 'all' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
            style={activeCat === 'all' ? { background: 'var(--theme-accent-soft)' } : undefined}
          >
            All <span className="tabular-nums opacity-70">{sessions.length}</span>
          </button>
          {categories.map(c => {
            const count = sessions.filter(s => s.category_key === c.key).length
            const active = activeCat === c.key
            return (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-medium transition-all', active ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                style={active ? { background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color } : undefined}
              >
                <span>{c.emoji}</span>
                {c.name}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sessions list */}
      {loading ? (
        <SkeletonList />
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--theme-accent) 30%, transparent), transparent 70%)' }}
          >
            <HugeiconsIcon icon={Award01Icon} size={30} className="text-[var(--theme-accent)]" />
          </span>
          <h3 className="text-[15px] font-semibold text-[var(--theme-text)]">No sessions here yet</h3>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--theme-muted)]">
            {activeCat === 'all' ? 'Create your first daily wellness session to get started.' : 'No sessions in this category. Try another or create one.'}
          </p>
          <button onClick={() => setCreating(true)} className={cn(primaryBtnCls, 'mt-4')} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} /> New Session
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, sessions: catSessions }) => (
            <div key={category.key}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-[16px]">{category.emoji}</span>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{category.name}</h2>
                <span className="h-1 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${category.color}, transparent)` }} />
                <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">{catSessions.length}</span>
              </div>
              <div className="space-y-2.5">
                {catSessions.map(s => (
                  <SessionRow key={s.id} session={s} category={category} allCategories={categories} brand={brand.id} queryKey={sessionsKey} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <SessionFormModal
          session={null}
          categories={categories}
          onClose={() => setCreating(false)}
          onSave={d => createMut.mutate(d)}
        />
      )}
    </div>
  )
}
