import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cinema } from '../../lib/brand-cinema'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  key: string
  name: string
  tagline: string
  emoji: string
  color: string
  order: number
}

interface FocusArea {
  key: string
  label: string
  emoji: string
}

interface TeachCard { id: string; type: 'teach'; heading: string; body: string; image_url?: string; key_points?: string[] }
interface ListCard { id: string; type: 'list'; heading: string; intro?: string; variant?: 'good' | 'avoid' | 'neutral'; items: string[] }
interface QuizCard { id: string; type: 'quiz'; question: string; options: string[]; correct_index: number; explanation: string }
interface TrueFalseCard { id: string; type: 'truefalse'; statement: string; is_true: boolean; explanation: string }
interface ReflectCard { id: string; type: 'reflect'; prompt: string; placeholder?: string }
interface TipCard { id: string; type: 'tip'; heading: string; body: string; habit?: string }
interface CompleteCard { id: string; type: 'complete'; takeaway: string; affirmation?: string }
type Card = TeachCard | ListCard | QuizCard | TrueFalseCard | ReflectCard | TipCard | CompleteCard

interface Session {
  id: string
  category_key: string
  title: string
  subtitle: string
  est_minutes: number
  points: number
  cards: Card[]
}

type ActionDimension = 'movement' | 'nutrition' | 'hydration' | 'sleep' | 'mindset'

interface PlanItem {
  kind: 'lesson' | 'action'
  ref_id: string
  dimension?: ActionDimension
  category_key?: string
  title: string
  done: boolean
}

interface DailyPlan {
  date: string
  items: PlanItem[]
  completed: boolean
  completed_at?: string
}

interface PlanTodayResponse {
  plan: DailyPlan
  level: number
  streak: number
  focus_area: string | null
  all_done: boolean
  freezes: number
  streak_at_risk: boolean
  freeze_used_notice: boolean
}

interface ReminderResponse {
  reminder_email_opt_in: boolean
  reminder_email: string | null
}

interface CompleteTaskResponse {
  plan: DailyPlan
  day_complete: boolean
  earned: number
  streak: number
  level: number
  leveled_up: boolean
}

interface StartResponse {
  token: string
}

// ── Brand palette ("Sanctuary") ────────────────────────────────────────────────
//
// Single source of truth for the wellness experience's warm-violet identity.
// Derived from `cinema('hfm')` so it can never drift off-brand. We surface a
// BRIGHT, friendly variant for these patient-facing screens (Elevate energy)
// while the deep-plum cinematic base only appears as the drifting aurora glow.

const HFM = cinema('hfm')

const SANCTUARY = {
  accent: HFM.accent, // violet #a855f7
  accent2: HFM.accent2, // rose #ec4899
  glow: HFM.glow,
  gradient: HFM.gradient, // violet → rose
  /** Soft warm-violet page wash. */
  pageBg: 'linear-gradient(180deg, #faf5ff 0%, #f6eefc 45%, #f3effb 100%)',
  /** Deep-plum cinematic backdrop for hero / session shell. */
  plumBg: HFM.baseBg, // #120a16
  /** Primary readable text on light surfaces. */
  ink: '#36264a',
  inkSoft: '#6b5b85',
  inkFaint: '#9a8db5',
  /** Hairline + soft surfaces. */
  line: '#ece2f7',
  tintBg: '#f6eefc',
} as const

/**
 * Harmonise any category accent into the warm-violet Sanctuary family so the
 * 7 categories still differentiate, but every screen reads unmistakably HFM.
 * We blend the raw category hue heavily toward the brand violet.
 */
function harmonize(raw: string | undefined): string {
  if (!raw) return SANCTUARY.accent
  return `color-mix(in srgb, ${raw} 55%, ${SANCTUARY.accent})`
}

/** A violet→rose-leaning gradient seeded from a (harmonised) accent. */
function accentGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, ${SANCTUARY.accent2}))`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'wellness_token'
const FALLBACK_COLOR = SANCTUARY.accent

function getBrand(): string {
  if (typeof window === 'undefined') return 'hfm'
  return new URLSearchParams(window.location.search).get('brand') || 'hfm'
}

const BRAND_NAMES: Record<string, string> = {
  hfm: 'HFM Intelligence',
  sc: 'SC Intelligence',
  default: 'AI OS',
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

// Dimension visual language for the action tasks — harmonised to the violet base.
const DIMENSIONS: Record<ActionDimension, { emoji: string; label: string; color: string }> = {
  movement: { emoji: '🚶‍♀️', label: 'Move', color: harmonize('#f97316') },
  nutrition: { emoji: '🥗', label: 'Nourish', color: harmonize('#10b981') },
  hydration: { emoji: '💧', label: 'Hydrate', color: harmonize('#0ea5e9') },
  sleep: { emoji: '🌙', label: 'Sleep', color: harmonize('#6366f1') },
  mindset: { emoji: '🧘‍♀️', label: 'Mindset', color: SANCTUARY.accent },
}

const LEVEL_TIERS: Record<number, string> = {
  1: 'Foundational',
  2: 'Building',
  3: 'Thriving',
}

function tierLabel(level: number): string {
  return LEVEL_TIERS[Math.min(3, Math.max(1, level))] ?? 'Thriving'
}

function friendlyDate(iso: string): string {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date()
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`GET ${path} failed`)
  return res.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed`)
  return res.json() as Promise<T>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    if (reduced) { setValue(target); return }
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])
  return value
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// ── Shared atoms ────────────────────────────────────────────────────────────────

/** Slow drifting violet/rose aurora — the Sanctuary's ambient glow. */
function Aurora({ tone = 'light' }: { tone?: 'light' | 'plum' }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="wl-blob-a absolute -left-24 -top-28 h-72 w-72 rounded-full blur-3xl"
        style={{ background: SANCTUARY.accent, opacity: tone === 'plum' ? 0.4 : 0.22 }}
      />
      <div
        className="wl-blob-b absolute -right-20 top-10 h-64 w-64 rounded-full blur-3xl"
        style={{ background: SANCTUARY.accent2, opacity: tone === 'plum' ? 0.34 : 0.16 }}
      />
      <div
        className="wl-blob-a absolute -bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl"
        style={{ background: HFM.blobs[2], opacity: tone === 'plum' ? 0.3 : 0.12 }}
      />
    </div>
  )
}

// ── Item visual helpers ───────────────────────────────────────────────────────

function itemVisual(
  item: PlanItem,
  categoryByKey: (key: string) => Category | undefined,
): { emoji: string; label: string; color: string } {
  if (item.kind === 'lesson') {
    const cat = item.category_key ? categoryByKey(item.category_key) : undefined
    return { emoji: cat?.emoji ?? '📖', label: 'Learn', color: harmonize(cat?.color) }
  }
  const dim = item.dimension ? DIMENSIONS[item.dimension] : undefined
  return { emoji: dim?.emoji ?? '✨', label: dim?.label ?? 'Action', color: dim?.color ?? FALLBACK_COLOR }
}

// ── Root component ────────────────────────────────────────────────────────────

interface ActiveSession {
  session: Session
  itemIndex: number // plan item index this lesson belongs to
}

export function WellnessPlayer() {
  const brand = getBrand()
  const brandName = BRAND_NAMES[brand] ?? BRAND_NAMES.default
  const [token, setToken] = useState<string | null>(getToken)
  const [active, setActive] = useState<ActiveSession | null>(null)
  const qc = useQueryClient()

  const categoriesQuery = useQuery({
    queryKey: ['wellness', 'categories', brand],
    queryFn: () => apiGet<{ categories: Category[] }>(`/api/wellness/categories?brand=${brand}`).then((r) => r.categories),
    staleTime: 5 * 60 * 1000,
  })

  const planQuery = useQuery({
    queryKey: ['wellness', 'plan', brand, token],
    queryFn: () => apiGet<PlanTodayResponse>(`/api/wellness/plan/today?brand=${brand}&token=${token ?? ''}`),
    enabled: !!token,
  })

  const categories = categoriesQuery.data ?? []
  const categoryByKey = (key: string): Category | undefined => categories.find((c) => c.key === key)

  const handleStarted = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
  }

  const invalidatePlan = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['wellness', 'plan', brand, token] })
  }, [qc, brand, token])

  const openLesson = async (itemIndex: number, refId: string) => {
    try {
      const { session } = await apiGet<{ session: Session }>(`/api/wellness/session/${refId}?brand=${brand}`)
      setActive({ session, itemIndex })
    } catch {
      /* ignore — stay on plan */
    }
  }

  const exitSession = (didComplete: boolean) => {
    setActive(null)
    if (didComplete) invalidatePlan()
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: SANCTUARY.pageBg, color: SANCTUARY.ink }}
    >
      <WellnessStyles />
      <Aurora />

      <div className="relative">
        {!token ? (
          <Onboarding brand={brand} onStarted={handleStarted} />
        ) : active ? (
          <SessionPlayer
            brand={brand}
            token={token}
            session={active.session}
            itemIndex={active.itemIndex}
            category={categoryByKey(active.session.category_key)}
            onExit={exitSession}
          />
        ) : (
          <DailyPlanHome
            brand={brand}
            token={token}
            plan={planQuery.data}
            loading={planQuery.isLoading}
            categoryByKey={categoryByKey}
            onOpenLesson={(idx, ref) => void openLesson(idx, ref)}
            onPlanChanged={invalidatePlan}
          />
        )}

        <Footer brandName={brandName} />
      </div>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer({ brandName }: { brandName: string }) {
  return (
    <footer className="px-6 py-8 text-center">
      <p className="text-[11px] leading-relaxed" style={{ color: SANCTUARY.inkFaint }}>
        Powered by {brandName} · general wellness education, not medical advice.
      </p>
    </footer>
  )
}

// ── A. Onboarding (welcome → name → focus) ──────────────────────────────────────

function Onboarding({ brand, onStarted }: { brand: string; onStarted: (token: string) => void }) {
  const [step, setStep] = useState<'welcome' | 'details' | 'focus'>('welcome')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  const focusAreasQuery = useQuery({
    queryKey: ['wellness', 'focus-areas', brand],
    queryFn: () => apiGet<{ focus_areas: FocusArea[] }>(`/api/wellness/focus-areas?brand=${brand}`).then((r) => r.focus_areas),
    staleTime: 5 * 60 * 1000,
  })

  const startMutation = useMutation({
    mutationFn: (vars: { name?: string; email?: string }) =>
      apiPost<StartResponse>('/api/wellness/start', { brand, ...vars }),
    onSuccess: (data) => { setPendingToken(data.token); setStep('focus') },
    onError: () => setError('Something went wrong. Please try again.'),
  })

  const focusMutation = useMutation({
    mutationFn: (focus_area: string) =>
      apiPost('/api/wellness/focus', { brand, token: pendingToken, focus_area }),
  })

  const handleBegin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please tell us your first name.'); return }
    setError('')
    startMutation.mutate({ name: name.trim(), email: email.trim() || undefined })
  }

  const chooseFocus = (key: string) => {
    if (!pendingToken) return
    focusMutation.mutate(key, {
      onSettled: () => onStarted(pendingToken),
    })
  }

  if (step === 'focus') {
    const areas = focusAreasQuery.data ?? []
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pt-12 pb-4 sm:max-w-lg sm:pt-16">
        <div className="wl-rise text-center">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl text-[34px] text-white shadow-lg"
            style={{ background: SANCTUARY.gradient }}>
            🎯
          </div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
            What would you like to focus on?
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed" style={{ color: SANCTUARY.inkSoft }}>
            We'll gently tune your daily plan around it. You can change this anytime.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {focusAreasQuery.isLoading
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/60" />)
            : areas.map((a, i) => {
                const label = a.key === 'general' ? 'A bit of everything' : a.label
                const busy = focusMutation.isPending
                return (
                  <button
                    key={a.key}
                    disabled={busy}
                    onClick={() => chooseFocus(a.key)}
                    className="wl-rise wf-press flex items-center gap-4 rounded-2xl border border-white bg-white/85 px-5 py-4 text-left shadow-sm backdrop-blur transition-transform disabled:opacity-60"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[26px]" style={{ background: SANCTUARY.tintBg }}>
                      {a.emoji}
                    </span>
                    <span className="text-[16px] font-bold">{label}</span>
                    <span className="ml-auto text-[18px]" style={{ color: SANCTUARY.accent }}>→</span>
                  </button>
                )
              })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pt-12 pb-4 sm:max-w-lg sm:pt-16">
      <div className="wl-rise text-center">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl text-[34px] text-white shadow-lg"
          style={{ background: SANCTUARY.gradient }}>
          🌿
        </div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
          Your Daily Wellness Plan
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed" style={{ color: SANCTUARY.inkSoft }}>
          Three small steps each day for a healthier you. A few mindful minutes — gentle habits that add up.
        </p>
      </div>

      <div className="wl-rise mt-9" style={{ animationDelay: '120ms' }}>
        {step === 'welcome' ? (
          <button
            onClick={() => setStep('details')}
            className="wf-press wl-pulse w-full rounded-2xl py-4 text-[16px] font-bold text-white shadow-lg transition-transform"
            style={{ background: SANCTUARY.gradient }}
          >
            Begin your journey →
          </button>
        ) : (
          <form onSubmit={handleBegin} className="rounded-3xl border border-white bg-white/85 p-5 shadow-lg backdrop-blur">
            <h2 className="text-[17px] font-bold">Let's get started</h2>
            <p className="mt-1 text-[13px]" style={{ color: SANCTUARY.inkSoft }}>We'll save your progress so you can pick up anytime.</p>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>
            )}
            <div className="mt-4 flex flex-col gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                autoFocus
                className="rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-colors"
                style={{ borderColor: SANCTUARY.line }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email (optional)"
                className="rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-colors"
                style={{ borderColor: SANCTUARY.line }}
              />
              <button
                type="submit"
                disabled={startMutation.isPending}
                className="wf-press rounded-2xl py-3.5 text-[15px] font-bold text-white shadow-md transition-transform disabled:opacity-60"
                style={{ background: SANCTUARY.gradient }}
              >
                {startMutation.isPending ? 'Setting up…' : 'Continue →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── B. Daily Plan home (the centerpiece) ────────────────────────────────────────

function DailyPlanHome({
  brand,
  token,
  plan,
  loading,
  categoryByKey,
  onOpenLesson,
  onPlanChanged,
}: {
  brand: string
  token: string
  plan: PlanTodayResponse | undefined
  loading: boolean
  categoryByKey: (key: string) => Category | undefined
  onOpenLesson: (itemIndex: number, refId: string) => void
  onPlanChanged: () => void
}) {
  const qc = useQueryClient()
  const [actionItem, setActionItem] = useState<{ index: number; item: PlanItem } | null>(null)
  const [showFocus, setShowFocus] = useState(false)
  const [celebration, setCelebration] = useState<CompleteTaskResponse | null>(null)
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  const streak = useCountUp(plan?.streak ?? 0)
  const level = plan?.level ?? 1

  const completeMutation = useMutation({
    mutationFn: (itemIndex: number) =>
      apiPost<CompleteTaskResponse>('/api/wellness/plan/complete-task', { brand, token, item_index: itemIndex }),
    onSuccess: (data) => {
      // Optimistically update the cached plan so the check shows instantly.
      qc.setQueryData<PlanTodayResponse>(['wellness', 'plan', brand, token], (prev) =>
        prev ? { ...prev, plan: data.plan, streak: data.streak, level: data.level, all_done: data.plan.completed } : prev,
      )
      setActionItem(null)
      if (data.day_complete) setCelebration(data)
    },
  })

  if (loading || !plan) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 sm:max-w-lg">
        <div className="h-16 animate-pulse rounded-3xl bg-white/60" />
        <div className="mt-5 h-10 w-2/3 animate-pulse rounded-xl bg-white/60" />
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/60" />
          ))}
        </div>
      </div>
    )
  }

  const items = plan.plan.items
  const doneCount = items.filter((i) => i.done).length
  const allDone = plan.all_done || plan.plan.completed
  const focusArea = plan.focus_area
  const freezes = plan.freezes ?? 0
  const streakAtRisk = plan.streak_at_risk && !allDone
  const nextItem = items.find((i) => !i.done)
  const nextIndex = items.findIndex((i) => !i.done)

  const handleTaskTap = (index: number, item: PlanItem) => {
    if (item.done) return
    if (item.kind === 'lesson') onOpenLesson(index, item.ref_id)
    else setActionItem({ index, item })
  }

  return (
    <div className="mx-auto max-w-md px-5 pt-7 sm:max-w-lg">
      {/* Top bar — streak / level / freeze / focus */}
      <div className="wl-rise flex items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/85 px-3.5 py-2.5 shadow-sm backdrop-blur">
          <span className="wf-flame text-[22px]">🔥</span>
          <div>
            <div className="text-[18px] font-extrabold leading-none tabular-nums">{streak}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>streak</div>
          </div>
        </div>
        {freezes > 0 && (
          <div
            className="group relative flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 shadow-sm"
            style={{ borderColor: 'color-mix(in srgb, #38bdf8 30%, white)', background: 'color-mix(in srgb, #38bdf8 10%, white)' }}
            title="Freezes protect your streak if you miss a day"
          >
            <span className="text-[18px]">❄️</span>
            <div>
              <div className="text-[15px] font-extrabold leading-none tabular-nums" style={{ color: '#2f7fb5' }}>{freezes}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#7aa8c7' }}>freeze{freezes === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}
        <div
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-white shadow-sm"
          style={{ background: SANCTUARY.gradient }}
        >
          <span className="text-[18px]">⭐</span>
          <div>
            <div className="text-[14px] font-extrabold leading-none">Level {level}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-white/80">{tierLabel(level)}</div>
          </div>
        </div>
        <button
          onClick={() => setShowFocus(true)}
          className="wf-press ml-auto flex items-center gap-1.5 rounded-full border border-white bg-white/85 px-3 py-2 text-[12px] font-bold shadow-sm backdrop-blur transition-transform"
          style={{ color: SANCTUARY.inkSoft }}
        >
          <FocusChipLabel focusArea={focusArea} />
        </button>
      </div>

      {allDone ? (
        <CompletedState streak={plan.streak} level={level} />
      ) : (
        <>
          {/* HERO — Today's Plan, one-tap start */}
          <div className="wl-rise relative mt-5 overflow-hidden rounded-[28px] p-6 text-white shadow-xl" style={{ animationDelay: '50ms', background: `linear-gradient(140deg, ${SANCTUARY.plumBg}, color-mix(in srgb, ${SANCTUARY.accent} 38%, ${SANCTUARY.plumBg}))` }}>
            <Aurora tone="plum" />
            <div className="relative">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">{friendlyDate(plan.plan.date)}</p>
              <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-tight">Today's Plan</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-white/80">
                {doneCount === 0
                  ? '3 small steps for a healthier you. One tap to begin.'
                  : `${doneCount} of ${items.length} done — keep the momentum going.`}
              </p>

              {nextItem && (
                <button
                  onClick={() => handleTaskTap(nextIndex, nextItem)}
                  className="wf-press wl-pulse mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[16px] font-extrabold shadow-lg transition-transform"
                  style={{ color: SANCTUARY.accent }}
                >
                  {doneCount === 0 ? 'Start today’s plan' : 'Continue'} →
                </button>
              )}

              {/* mini progress dots */}
              <div className="mt-4 flex items-center gap-1.5">
                {items.map((it, i) => (
                  <span
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-all"
                    style={{ background: it.done ? '#fff' : 'rgba(255,255,255,0.28)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Freeze-saved notice (one-time, dismissable) */}
          {plan.freeze_used_notice && !noticeDismissed && (
            <div className="wl-rise mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm" style={{ animationDelay: '80ms', borderColor: 'color-mix(in srgb, #38bdf8 28%, white)', background: 'color-mix(in srgb, #38bdf8 9%, white)' }}>
              <span className="text-[22px]">❄️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold" style={{ color: '#2f7fb5' }}>We used a freeze to protect your {plan.streak}-day streak</div>
                <div className="mt-0.5 text-[12px] leading-relaxed" style={{ color: '#5a86a3' }}>Life happens — your streak is safe. Let's keep it going today. 💜</div>
              </div>
              <button
                onClick={() => setNoticeDismissed(true)}
                aria-label="Dismiss"
                className="wf-press shrink-0 rounded-full px-1 text-[16px]"
                style={{ color: '#9bbdd4' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Streak-at-risk nudge */}
          {streakAtRisk && (
            <div className="wl-rise mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm" style={{ animationDelay: '90ms', borderColor: 'color-mix(in srgb, #f97316 30%, white)', background: 'color-mix(in srgb, #f97316 8%, white)' }}>
              <span className="wf-flame text-[22px]">🔥</span>
              <div className="text-[13px] font-bold leading-snug" style={{ color: '#c2622a' }}>
                Don't break your {plan.streak}-day streak — finish today's plan!
                {freezes > 0 && (
                  <span className="font-semibold" style={{ color: '#a8703f' }}> {' '}(or a ❄️ freeze has you covered)</span>
                )}
              </div>
            </div>
          )}

          {/* Progress bar + count */}
          <div className="wl-rise mt-5" style={{ animationDelay: '100ms' }}>
            <ProgressBar done={doneCount} total={items.length} />
          </div>

          {/* Task cards */}
          <div className="mt-4 flex flex-col gap-3">
            {items.map((item, i) => (
              <div key={`${item.ref_id}-${i}`} className="wl-rise" style={{ animationDelay: `${140 + i * 70}ms` }}>
                <TaskCard
                  item={item}
                  visual={itemVisual(item, categoryByKey)}
                  onTap={() => handleTaskTap(i, item)}
                />
              </div>
            ))}
          </div>

          {/* Daily-reminder opt-in */}
          <div className="wl-rise mt-6" style={{ animationDelay: '340ms' }}>
            <RemindMeDaily brand={brand} token={token} />
          </div>

          {/* Why daily */}
          <p className="wl-rise mt-5 text-center text-[12px] leading-relaxed" style={{ animationDelay: '400ms', color: SANCTUARY.inkFaint }}>
            A little each day builds lasting change. Come back tomorrow to keep your streak alive. 🌙
          </p>
        </>
      )}

      {/* Action confirm sheet */}
      {actionItem && (
        <ActionSheet
          item={actionItem.item}
          visual={itemVisual(actionItem.item, categoryByKey)}
          pending={completeMutation.isPending}
          onConfirm={() => completeMutation.mutate(actionItem.index)}
          onClose={() => { if (!completeMutation.isPending) setActionItem(null) }}
        />
      )}

      {/* Focus picker */}
      {showFocus && (
        <FocusPicker
          brand={brand}
          token={token}
          current={focusArea}
          onClose={() => setShowFocus(false)}
          onChanged={() => { setShowFocus(false); onPlanChanged() }}
        />
      )}

      {/* Day-complete celebration */}
      {celebration && (
        <CelebrationOverlay result={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  )
}

function FocusChipLabel({ focusArea }: { focusArea: string | null }) {
  const brand = getBrand()
  const q = useQuery({
    queryKey: ['wellness', 'focus-areas', brand],
    queryFn: () => apiGet<{ focus_areas: FocusArea[] }>(`/api/wellness/focus-areas?brand=${brand}`).then((r) => r.focus_areas),
    staleTime: 5 * 60 * 1000,
  })
  const area = (q.data ?? []).find((a) => a.key === (focusArea ?? 'general'))
  return (
    <>
      <span className="text-[15px]">{area?.emoji ?? '✨'}</span>
      <span>{focusArea && area && focusArea !== 'general' ? area.label.replace(' Wellness', '') : 'Focus'}</span>
    </>
  )
}

function RemindMeDaily({ brand, token }: { brand: string; token: string }) {
  const [needEmail, setNeedEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [optedIn, setOptedIn] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (vars: { opt_in: boolean; email?: string }) =>
      apiPost<ReminderResponse>('/api/wellness/reminders', { brand, token, ...vars }),
    onSuccess: (data, vars) => {
      if (vars.opt_in && !data.reminder_email) {
        // No email on file yet → reveal the inline field.
        setNeedEmail(true)
        setNote(null)
        return
      }
      setOptedIn(data.reminder_email_opt_in)
      setNeedEmail(false)
      setNote(data.reminder_email_opt_in ? 'Lovely — we\'ll send a gentle daily nudge. 💌' : 'No more reminders — you can turn them back on anytime.')
    },
    onError: () => setNote('Something went wrong. Please try again.'),
  })

  if (optedIn) {
    return (
      <div className="rounded-2xl border px-4 py-3 text-center shadow-sm" style={{ borderColor: 'color-mix(in srgb, #10b981 24%, white)', background: 'color-mix(in srgb, #10b981 8%, white)' }}>
        <div className="text-[13px] font-bold" style={{ color: '#3f9266' }}>💌 Daily nudge on</div>
        {note && <div className="mt-0.5 text-[12px]" style={{ color: '#5e9a78' }}>{note}</div>}
        <button
          onClick={() => mutation.mutate({ opt_in: false })}
          disabled={mutation.isPending}
          className="wf-press mt-1 text-[11px] font-semibold underline disabled:opacity-60"
          style={{ color: SANCTUARY.inkFaint }}
        >
          Turn off
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white bg-white/85 px-4 py-3.5 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-[22px]">🔔</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold" style={{ color: SANCTUARY.ink }}>Remind me daily</div>
          <div className="text-[12px] leading-snug" style={{ color: SANCTUARY.inkFaint }}>A gentle email nudge so you never miss a day.</div>
        </div>
        {!needEmail && (
          <button
            onClick={() => mutation.mutate({ opt_in: true })}
            disabled={mutation.isPending}
            className="wf-press shrink-0 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-transform disabled:opacity-60"
            style={{ background: SANCTUARY.gradient }}
          >
            {mutation.isPending ? '…' : 'Nudge me'}
          </button>
        )}
      </div>
      {needEmail && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (email.trim()) mutation.mutate({ opt_in: true, email: email.trim() }) }}
          className="mt-3 flex gap-2"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@email.com"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-[14px] outline-none transition-colors"
            style={{ borderColor: SANCTUARY.line }}
          />
          <button
            type="submit"
            disabled={mutation.isPending || !email.trim()}
            className="wf-press shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-transform disabled:opacity-60"
            style={{ background: SANCTUARY.gradient }}
          >
            Save
          </button>
        </form>
      )}
      {note && <div className="mt-2 text-[12px]" style={{ color: SANCTUARY.accent }}>{note}</div>}
    </div>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? (done / total) * 100 : 0
  return (
    <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between text-[12px] font-bold">
        <span style={{ color: SANCTUARY.inkSoft }}>{done} of {total} complete</span>
        <span className="tabular-nums" style={{ color: SANCTUARY.accent }}>{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: SANCTUARY.tintBg }}>
        <div
          className={`relative h-full rounded-full transition-all duration-700 ${pct > 0 && pct < 100 ? 'wl-shimmer' : ''}`}
          style={{ width: `${pct}%`, background: SANCTUARY.gradient }}
        />
      </div>
    </div>
  )
}

function TaskCard({
  item,
  visual,
  onTap,
}: {
  item: PlanItem
  visual: { emoji: string; label: string; color: string }
  onTap: () => void
}) {
  const { emoji, label, color } = visual
  if (item.done) {
    return (
      <div
        className="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 px-5 py-4 shadow-sm"
        style={{ borderColor: '#bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' }}
      >
        <span className="wl-spring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-[24px] text-white shadow">
          ✓
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{label} · Done</div>
          <div className="truncate text-[15px] font-bold text-emerald-800/70 line-through decoration-emerald-400/60">{item.title}</div>
        </div>
      </div>
    )
  }
  return (
    <button
      onClick={onTap}
      className="wf-press group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-white bg-white/90 px-5 py-4 text-left shadow-md backdrop-blur transition-transform"
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 45%, ${SANCTUARY.accent2}))` }}
      />
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[28px]"
        style={{ background: `color-mix(in srgb, ${color} 14%, white)` }}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `color-mix(in srgb, ${color} 78%, ${SANCTUARY.ink})` }}>
          {label}
        </div>
        <div className="text-[16px] font-bold leading-snug" style={{ color: SANCTUARY.ink }}>{item.title}</div>
      </div>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[15px] transition-colors"
        style={{ borderColor: `color-mix(in srgb, ${color} 35%, white)`, color }}
        aria-hidden
      >
        {item.kind === 'lesson' ? '›' : '○'}
      </span>
    </button>
  )
}

function ActionSheet({
  item,
  visual,
  pending,
  onConfirm,
  onClose,
}: {
  item: PlanItem
  visual: { emoji: string; label: string; color: string }
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { emoji, label, color } = visual
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="wf-sheet-in w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-sm sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl text-[40px] shadow-sm"
            style={{ background: `color-mix(in srgb, ${color} 14%, white)` }}
          >
            {emoji}
          </div>
          <div className="mt-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: `color-mix(in srgb, ${color} 78%, ${SANCTUARY.ink})` }}>
            {label}
          </div>
          <h3 className="mt-1 text-[20px] font-extrabold leading-tight">{item.title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: SANCTUARY.inkSoft }}>
            When you've done it, tap below — every small step counts.
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={pending}
          className="wf-press mt-6 w-full rounded-2xl py-4 text-[16px] font-bold text-white shadow-lg transition-transform disabled:opacity-60"
          style={{ background: accentGradient(color) }}
        >
          {pending ? 'Saving…' : 'Mark Done ✓'}
        </button>
        <button
          onClick={onClose}
          disabled={pending}
          className="wf-press mt-2 w-full rounded-2xl py-3 text-[14px] font-semibold transition-transform disabled:opacity-60"
          style={{ color: SANCTUARY.inkFaint }}
        >
          Not yet
        </button>
      </div>
    </div>
  )
}

function FocusPicker({
  brand,
  token,
  current,
  onClose,
  onChanged,
}: {
  brand: string
  token: string
  current: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const focusAreasQuery = useQuery({
    queryKey: ['wellness', 'focus-areas', brand],
    queryFn: () => apiGet<{ focus_areas: FocusArea[] }>(`/api/wellness/focus-areas?brand=${brand}`).then((r) => r.focus_areas),
    staleTime: 5 * 60 * 1000,
  })
  const mutation = useMutation({
    mutationFn: (focus_area: string) => apiPost('/api/wellness/focus', { brand, token, focus_area }),
    onSuccess: onChanged,
  })
  const areas = focusAreasQuery.data ?? []
  const activeKey = current ?? 'general'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="wf-sheet-in w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-sm sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[19px] font-extrabold">Change your focus</h3>
        <p className="mt-1 text-[13px]" style={{ color: SANCTUARY.inkSoft }}>Your daily plan gently adapts to this.</p>
        <div className="mt-4 flex flex-col gap-2.5">
          {areas.map((a) => {
            const label = a.key === 'general' ? 'A bit of everything' : a.label
            const isActive = a.key === activeKey
            return (
              <button
                key={a.key}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(a.key)}
                className="wf-press flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-transform disabled:opacity-60"
                style={{
                  borderColor: isActive ? SANCTUARY.accent : SANCTUARY.line,
                  background: isActive ? SANCTUARY.tintBg : 'white',
                }}
              >
                <span className="text-[24px]">{a.emoji}</span>
                <span className="text-[15px] font-bold">{label}</span>
                {isActive && <span className="ml-auto text-[16px]" style={{ color: SANCTUARY.accent }}>✓</span>}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="wf-press mt-4 w-full rounded-2xl py-3 text-[14px] font-semibold transition-transform"
          style={{ color: SANCTUARY.inkFaint }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── Completed / come-back-tomorrow state ────────────────────────────────────────

function CompletedState({ streak, level }: { streak: number; level: number }) {
  return (
    <div className="wl-rise mt-6 flex flex-col items-center text-center">
      <div className="wl-spring relative">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full text-[52px] text-white shadow-lg"
          style={{ background: SANCTUARY.gradient }}
        >
          🌙
        </div>
      </div>
      <h1 className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight">You're all done for today!</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed" style={{ color: SANCTUARY.inkSoft }}>
        Beautiful work. Rest up — your next plan unlocks tomorrow. 🌙
      </p>

      <div className="mt-6 flex w-full max-w-xs gap-3">
        <div className="flex-1 rounded-2xl border border-white bg-white/85 py-4 shadow-sm backdrop-blur">
          <div className="text-[24px] font-extrabold leading-none">🔥 {streak}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>day streak</div>
        </div>
        <div className="flex-1 rounded-2xl border border-white bg-white/85 py-4 shadow-sm backdrop-blur">
          <div className="text-[24px] font-extrabold leading-none" style={{ color: SANCTUARY.accent }}>Lv {level}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>{tierLabel(level)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white/60 px-5 py-3 text-[13px] font-semibold" style={{ borderColor: SANCTUARY.line, color: SANCTUARY.inkSoft }}>
        Come back tomorrow to keep your streak going ✨
      </div>
    </div>
  )
}

function CelebrationOverlay({ result, onClose }: { result: CompleteTaskResponse; onClose: () => void }) {
  const reduced = usePrefersReducedMotion()
  const points = useCountUp(result.earned, 1100)
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/45 px-6 backdrop-blur-sm" onClick={onClose}>
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="wf-confetti absolute top-0 block h-2.5 w-2.5 rounded-sm"
              style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.dur }}
            />
          ))}
        </div>
      )}
      <div
        className="wl-spring relative w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[64px]">🎉</div>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight">Day complete!</h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: SANCTUARY.inkSoft }}>All 3 steps done. You showed up for yourself today.</p>

        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-2xl border border-white py-3 shadow-sm" style={{ background: SANCTUARY.tintBg }}>
            <div className="text-[22px] font-extrabold tabular-nums" style={{ color: SANCTUARY.accent }}>+{points}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>points</div>
          </div>
          <div className="flex-1 rounded-2xl border border-white py-3 shadow-sm" style={{ background: 'color-mix(in srgb, #f97316 8%, white)' }}>
            <div className="text-[22px] font-extrabold">🔥 {result.streak}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>day streak</div>
          </div>
        </div>

        {result.leveled_up && (
          <div
            className="wl-spring mt-3 rounded-2xl py-3 text-[15px] font-extrabold text-white shadow-md"
            style={{ background: SANCTUARY.gradient }}
          >
            ⭐ You've reached Level {result.level} — {tierLabel(result.level)}!
          </div>
        )}

        <button
          onClick={onClose}
          className="wf-press mt-6 w-full rounded-2xl py-3.5 text-[15px] font-bold text-white shadow-lg transition-transform"
          style={{ background: SANCTUARY.gradient }}
        >
          See you tomorrow 🌙
        </button>
      </div>
    </div>
  )
}

// ── C. Session player ─────────────────────────────────────────────────────────

function SessionPlayer({
  brand,
  token,
  session,
  itemIndex,
  category,
  onExit,
}: {
  brand: string
  token: string
  session: Session
  itemIndex: number
  category: Category | undefined
  onExit: (didComplete: boolean) => void
}) {
  const color = harmonize(category?.color)
  const [index, setIndex] = useState(0)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [result, setResult] = useState<CompleteTaskResponse | null>(null)
  const completedRef = useRef(false)
  const reduced = usePrefersReducedMotion()

  const cards = session.cards
  const total = cards.length
  const card = cards[index]

  // Report lesson completion back to the daily plan via complete-task.
  const completeMutation = useMutation({
    mutationFn: () =>
      apiPost<CompleteTaskResponse>('/api/wellness/plan/complete-task', {
        brand,
        token,
        item_index: itemIndex,
      }),
    onSuccess: (data) => setResult(data),
  })

  // Fire completion exactly once when reaching the complete card.
  useEffect(() => {
    if (card?.type === 'complete' && !completedRef.current) {
      completedRef.current = true
      completeMutation.mutate()
    }
  }, [card, completeMutation])

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const setReflection = (id: string, value: string) =>
    setReflections((prev) => ({ ...prev, [id]: value }))

  const progressPct = total > 0 ? ((index + 1) / total) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: SANCTUARY.pageBg }}>
      <Aurora />
      {/* Top bar */}
      <div className="relative flex items-center gap-3 px-5 pt-5 pb-2">
        <button
          onClick={() => setConfirmLeave(true)}
          aria-label="Close session"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/85 text-[18px] shadow-sm transition-transform active:scale-90"
          style={{ color: SANCTUARY.inkSoft }}
        >
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/75">
          <div
            className="relative h-full rounded-full transition-all duration-500 wl-shimmer"
            style={{ width: `${progressPct}%`, background: accentGradient(color) }}
          />
        </div>
        <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: SANCTUARY.inkFaint }}>
          {index + 1}/{total}
        </span>
      </div>

      {/* Card area */}
      <div className="relative flex flex-1 flex-col overflow-y-auto px-5 pb-8">
        <div
          key={card?.id ?? index}
          className={reduced ? '' : 'wl-card-in'}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          {card && (
            <CardView
              card={card}
              color={color}
              reflectionValue={card.type === 'reflect' ? reflections[card.id] ?? '' : ''}
              onReflect={setReflection}
              result={result}
              completePending={completeMutation.isPending}
              onNext={goNext}
              onDone={() => onExit(true)}
            />
          )}
        </div>
      </div>

      {/* Confirm leave sheet */}
      {confirmLeave && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="wf-sheet-in w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-sm sm:rounded-3xl">
            <h3 className="text-[18px] font-bold">Leave this lesson?</h3>
            <p className="mt-1.5 text-[14px]" style={{ color: SANCTUARY.inkSoft }}>Your progress in this lesson won't be saved yet.</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="wf-press flex-1 rounded-2xl border py-3 text-[15px] font-semibold transition-transform"
                style={{ borderColor: SANCTUARY.line }}
              >
                Keep going
              </button>
              <button
                onClick={() => onExit(false)}
                className="wf-press flex-1 rounded-2xl py-3 text-[15px] font-bold text-white transition-transform"
                style={{ background: SANCTUARY.gradient }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card renderer ─────────────────────────────────────────────────────────────

function CardView({
  card,
  color,
  reflectionValue,
  onReflect,
  result,
  completePending,
  onNext,
  onDone,
}: {
  card: Card
  color: string
  reflectionValue: string
  onReflect: (id: string, value: string) => void
  result: CompleteTaskResponse | null
  completePending: boolean
  onNext: () => void
  onDone: () => void
}) {
  switch (card.type) {
    case 'teach':
      return <TeachView card={card} color={color} onNext={onNext} />
    case 'list':
      return <ListView card={card} color={color} onNext={onNext} />
    case 'quiz':
      return <QuizView card={card} color={color} onNext={onNext} />
    case 'truefalse':
      return <TrueFalseView card={card} color={color} onNext={onNext} />
    case 'reflect':
      return <ReflectView card={card} color={color} value={reflectionValue} onReflect={onReflect} onNext={onNext} />
    case 'tip':
      return <TipView card={card} color={color} onNext={onNext} />
    case 'complete':
      return <CompleteView card={card} color={color} result={result} pending={completePending} onDone={onDone} />
  }
}

function PrimaryButton({ color, children, onClick }: { color: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="wf-press mt-auto w-full rounded-2xl py-4 text-[16px] font-bold text-white shadow-lg transition-transform"
      style={{ background: accentGradient(color) }}
    >
      {children}
    </button>
  )
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function TeachView({ card, color, onNext }: { card: TeachCard; color: string; onNext: () => void }) {
  const paragraphs = splitParagraphs(card.body ?? '')
  const keyPoints = (card.key_points ?? []).filter((p) => p.trim())
  // Tappable "check off" state for each key point — satisfying pop.
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))

  return (
    <div className="flex flex-1 flex-col pt-2">
      {card.image_url && (
        <img src={card.image_url} alt="" className="wl-rise mb-5 max-h-52 w-full rounded-3xl object-cover shadow-md" />
      )}
      <h2 className="wl-head text-[26px] font-extrabold leading-tight tracking-tight">{card.heading}</h2>
      <div className="mt-4 flex flex-col gap-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="wl-rise text-[16px] leading-[1.7]" style={{ animationDelay: `${80 + i * 60}ms`, color: '#4a4263' }}>{p}</p>
        ))}
      </div>
      {keyPoints.length > 0 && (
        <div
          className="wl-rise mt-6 rounded-3xl border p-5 shadow-sm"
          style={{ animationDelay: '160ms', borderColor: `color-mix(in srgb, ${color} 22%, white)`, background: `color-mix(in srgb, ${color} 6%, white)` }}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: `color-mix(in srgb, ${color} 70%, ${SANCTUARY.ink})` }}>
            Tap to check off
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {keyPoints.map((point, i) => {
              const on = !!checked[i]
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="wf-press flex items-start gap-3 rounded-2xl border-2 bg-white/70 px-3.5 py-3 text-left transition-colors"
                  style={{ borderColor: on ? color : 'transparent' }}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${on ? 'wl-spring text-white' : ''}`}
                    style={{ background: on ? color : `color-mix(in srgb, ${color} 16%, white)`, color: on ? '#fff' : color }}
                    aria-hidden
                  >
                    {on ? '✓' : '○'}
                  </span>
                  <span className="text-[15px] leading-relaxed" style={{ color: '#4a4263' }}>{point}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="h-6" />
      <PrimaryButton color={color} onClick={onNext}>Got it →</PrimaryButton>
    </div>
  )
}

const LIST_VARIANTS = {
  good: { tint: '#10b981', label: 'Embrace', bullet: '✓', emoji: '🌿' },
  avoid: { tint: '#f59e0b', label: 'Limit', bullet: '—', emoji: '⏸' },
  neutral: { tint: '', label: '', bullet: '', emoji: '' },
} as const

function ListItemRow({
  raw,
  tint,
  bullet,
  accent,
  index,
}: {
  raw: string
  tint: string
  bullet: string
  accent: string
  index: number
}) {
  const dashIdx = raw.indexOf(' — ')
  const name = dashIdx >= 0 ? raw.slice(0, dashIdx) : raw
  const why = dashIdx >= 0 ? raw.slice(dashIdx + 3) : ''
  const [fav, setFav] = useState(false)
  return (
    <li
      className="wl-rise flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {bullet ? (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: tint }}
          aria-hidden
        >
          {bullet}
        </span>
      ) : (
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
      )}
      <span className="flex-1 text-[15px] leading-relaxed" style={{ color: '#4a4263' }}>
        <span className="font-bold" style={{ color: SANCTUARY.ink }}>{name}</span>
        {why && <span style={{ color: '#7a7196' }}> — {why}</span>}
      </span>
      <button
        onClick={() => setFav((v) => !v)}
        aria-label={fav ? 'Unfavorite' : 'Favorite'}
        className={`wf-press shrink-0 text-[18px] leading-none transition-transform ${fav ? 'wl-spring' : ''}`}
        style={{ color: fav ? accent : '#d6cce8' }}
      >
        {fav ? '★' : '☆'}
      </button>
    </li>
  )
}

function ListView({ card, color, onNext }: { card: ListCard; color: string; onNext: () => void }) {
  const variant = card.variant ?? 'neutral'
  const v = LIST_VARIANTS[variant]
  const tint = v.tint || color
  const items = (card.items ?? []).filter((i) => i.trim())
  return (
    <div className="flex flex-1 flex-col pt-2">
      {v.label && (
        <span
          className="wl-rise inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: `color-mix(in srgb, ${tint} 14%, white)`, color: `color-mix(in srgb, ${tint} 78%, ${SANCTUARY.ink})` }}
        >
          {v.emoji} {v.label}
        </span>
      )}
      <h2 className="wl-head mt-3 text-[26px] font-extrabold leading-tight tracking-tight">{card.heading}</h2>
      {card.intro && <p className="wl-rise mt-2.5 text-[16px] leading-relaxed" style={{ color: '#4a4263' }}>{card.intro}</p>}
      <ul
        className="mt-5 flex flex-col gap-2.5 rounded-3xl border p-3"
        style={{ borderColor: `color-mix(in srgb, ${tint} 20%, white)`, background: `color-mix(in srgb, ${tint} 7%, white)` }}
      >
        {items.map((item, i) => (
          <ListItemRow key={i} raw={item} tint={tint} bullet={v.bullet} accent={color} index={i} />
        ))}
      </ul>
      <p className="mt-3 text-center text-[12px]" style={{ color: SANCTUARY.inkFaint }}>Tap ☆ to favorite what speaks to you.</p>
      <div className="h-6" />
      <PrimaryButton color={color} onClick={onNext}>Continue</PrimaryButton>
    </div>
  )
}

function QuizView({ card, color, onNext }: { card: QuizCard; color: string; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  const isCorrect = picked === card.correct_index
  const reduced = usePrefersReducedMotion()

  const handlePick = (i: number) => {
    if (answered) return
    setPicked(i)
  }

  return (
    <div className="flex flex-1 flex-col pt-2">
      <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>Quiz</span>
      <h2 className="wl-head mt-2 text-[23px] font-extrabold leading-tight">{card.question}</h2>
      <div className="mt-5 flex flex-col gap-3">
        {card.options.map((opt, i) => {
          const showCorrect = answered && i === card.correct_index
          const showWrong = answered && i === picked && !isCorrect
          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={answered}
              className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition-all ${showWrong ? 'wf-shake' : ''} ${!answered ? 'wf-press' : ''}`}
              style={{
                borderColor: showCorrect ? '#10b981' : showWrong ? '#ef4444' : SANCTUARY.line,
                background: showCorrect ? '#ecfdf5' : showWrong ? '#fef2f2' : 'white',
                color: showCorrect ? '#047857' : showWrong ? '#b91c1c' : SANCTUARY.ink,
              }}
            >
              {showCorrect && !reduced && (
                <span className="wl-burst pointer-events-none absolute left-6 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full" style={{ background: '#10b98155' }} aria-hidden />
              )}
              {opt}
              {showCorrect && <span className="wl-spring float-right">✓</span>}
              {showWrong && <span className="float-right">✕</span>}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="wl-rise mt-4">
          {isCorrect ? (
            <div className="wl-spring relative mb-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-bold text-emerald-700">
              ✨ Nice!
              <span className="wl-point absolute -right-7 -top-1 text-[14px] font-extrabold" style={{ color: SANCTUARY.accent }}>+1</span>
            </div>
          ) : (
            <div className="mb-2 inline-block rounded-full bg-rose-100 px-3 py-1 text-[13px] font-bold text-rose-700">
              Good try
            </div>
          )}
          <p className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: SANCTUARY.tintBg, color: '#4a4263' }}>
            {card.explanation}
          </p>
        </div>
      )}
      <div className="h-5" />
      {answered ? (
        <PrimaryButton color={color} onClick={onNext}>Continue</PrimaryButton>
      ) : (
        <div className="mt-auto py-2 text-center text-[13px]" style={{ color: SANCTUARY.inkFaint }}>Pick an answer to continue</div>
      )}
    </div>
  )
}

function TrueFalseView({ card, color, onNext }: { card: TrueFalseCard; color: string; onNext: () => void }) {
  const [picked, setPicked] = useState<boolean | null>(null)
  const answered = picked !== null
  const isCorrect = picked === card.is_true
  const reduced = usePrefersReducedMotion()

  const btnStyle = (val: boolean) => {
    const showCorrect = answered && val === card.is_true
    const showWrong = answered && val === picked && !isCorrect
    return {
      borderColor: showCorrect ? '#10b981' : showWrong ? '#ef4444' : SANCTUARY.line,
      background: showCorrect ? '#ecfdf5' : showWrong ? '#fef2f2' : 'white',
      color: showCorrect ? '#047857' : showWrong ? '#b91c1c' : SANCTUARY.ink,
    }
  }

  return (
    <div className="flex flex-1 flex-col pt-2">
      <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>True or False?</span>
      <h2 className="wl-head mt-2 text-[24px] font-extrabold leading-tight">{card.statement}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[true, false].map((val) => {
          const showWrong = answered && val === picked && !isCorrect
          const showCorrect = answered && val === card.is_true
          return (
            <button
              key={String(val)}
              onClick={() => !answered && setPicked(val)}
              disabled={answered}
              className={`relative overflow-hidden rounded-3xl border-2 py-7 text-[18px] font-extrabold transition-all ${showWrong ? 'wf-shake' : ''} ${!answered ? 'wf-press' : ''}`}
              style={btnStyle(val)}
            >
              {showCorrect && !reduced && (
                <span className="wl-burst pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: '#10b98155' }} aria-hidden />
              )}
              {val ? 'True' : 'False'}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="wl-rise mt-4">
          <div className={`mb-2 inline-block rounded-full px-3 py-1 text-[13px] font-bold ${isCorrect ? 'wl-spring bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {isCorrect ? '✨ Correct!' : 'Good try'}
          </div>
          <p className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: SANCTUARY.tintBg, color: '#4a4263' }}>
            {card.explanation}
          </p>
        </div>
      )}
      <div className="h-5" />
      {answered ? (
        <PrimaryButton color={color} onClick={onNext}>Continue</PrimaryButton>
      ) : (
        <div className="mt-auto py-2 text-center text-[13px]" style={{ color: SANCTUARY.inkFaint }}>Choose to continue</div>
      )}
    </div>
  )
}

function ReflectView({
  card,
  color,
  value,
  onReflect,
  onNext,
}: {
  card: ReflectCard
  color: string
  value: string
  onReflect: (id: string, value: string) => void
  onNext: () => void
}) {
  const [focused, setFocused] = useState(false)
  const saved = value.trim().length > 0
  return (
    <div className="flex flex-1 flex-col pt-2">
      <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>Reflect</span>
      <h2 className="wl-head mt-2 text-[24px] font-extrabold leading-tight">{card.prompt}</h2>
      <div
        className="mt-5 rounded-3xl border-2 p-1.5 transition-colors"
        style={{ borderColor: focused ? color : `color-mix(in srgb, ${color} 22%, white)`, background: `color-mix(in srgb, ${color} 5%, white)` }}
      >
        <textarea
          value={value}
          onChange={(e) => onReflect(card.id, e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={card.placeholder ?? 'Take a moment to write…'}
          rows={focused || saved ? 6 : 4}
          className="w-full resize-none rounded-[20px] bg-white/80 px-4 py-4 text-[15px] leading-relaxed outline-none transition-all"
        />
      </div>
      {saved && (
        <div className="wl-rise mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color: `color-mix(in srgb, ${color} 80%, ${SANCTUARY.ink})` }}>
          saved ✨
        </div>
      )}
      <div className="h-5" />
      <PrimaryButton color={color} onClick={onNext}>
        {saved ? 'Continue' : 'Skip for now'}
      </PrimaryButton>
    </div>
  )
}

function TipView({ card, color, onNext }: { card: TipCard; color: string; onNext: () => void }) {
  const [committed, setCommitted] = useState(false)
  return (
    <div className="flex flex-1 flex-col pt-2">
      <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>Micro-habit</span>
      <div
        className="mt-3 rounded-3xl border-2 p-6 shadow-sm"
        style={{ borderColor: `color-mix(in srgb, ${color} 30%, white)`, background: `color-mix(in srgb, ${color} 7%, white)` }}
      >
        <div className="wl-head text-[34px]">💡</div>
        <h2 className="wl-head mt-2 text-[24px] font-extrabold leading-tight">{card.heading}</h2>
        <p className="wl-rise mt-3 text-[16px] leading-relaxed" style={{ animationDelay: '80ms', color: '#4a4263' }}>{card.body}</p>
        {card.habit && (
          <button
            onClick={() => setCommitted((v) => !v)}
            className={`wf-press mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold transition-all ${committed ? 'wl-spring' : ''}`}
            style={{
              background: committed ? color : 'white',
              color: committed ? 'white' : `color-mix(in srgb, ${color} 80%, ${SANCTUARY.ink})`,
              border: `2px solid ${color}`,
            }}
          >
            <span>{committed ? '✓' : '○'}</span>
            {committed ? "I'll do this today!" : card.habit}
          </button>
        )}
        {committed && (
          <p className="wl-rise mt-3 text-[13px] font-semibold" style={{ color: `color-mix(in srgb, ${color} 80%, ${SANCTUARY.ink})` }}>
            Beautiful — small habits, big change. 🌱
          </p>
        )}
      </div>
      <div className="flex-1" />
      <PrimaryButton color={color} onClick={onNext}>Continue</PrimaryButton>
    </div>
  )
}

function CompleteView({
  card,
  color,
  result,
  pending,
  onDone,
}: {
  card: CompleteCard
  color: string
  result: CompleteTaskResponse | null
  pending: boolean
  onDone: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const points = useCountUp(result?.earned ?? 0, 1100)
  return (
    <div className="relative flex flex-1 flex-col items-center pt-6 text-center">
      {/* Confetti */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="wf-confetti absolute top-0 block h-2.5 w-2.5 rounded-sm"
              style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.dur }}
            />
          ))}
        </div>
      )}

      <div className="wl-spring relative text-[64px]">🎉</div>
      <h2 className="relative mt-2 text-[28px] font-extrabold leading-tight">Lesson complete!</h2>
      <p className="relative mt-2 max-w-sm text-[16px] leading-relaxed" style={{ color: '#4a4263' }}>{card.takeaway}</p>

      {card.affirmation && (
        <div
          className="relative mt-5 w-full max-w-sm rounded-3xl border-2 px-5 py-5 text-[16px] font-semibold italic leading-relaxed"
          style={{ borderColor: `color-mix(in srgb, ${color} 28%, white)`, background: `color-mix(in srgb, ${color} 7%, white)`, color: `color-mix(in srgb, ${color} 78%, ${SANCTUARY.ink})` }}
        >
          "{card.affirmation}"
        </div>
      )}

      {/* Earned rewards from the daily plan */}
      <div className="relative mt-6 w-full max-w-sm">
        {pending && !result ? (
          <div className="h-16 animate-pulse rounded-2xl bg-white/70" />
        ) : result ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-2xl border border-white bg-white/85 py-3 shadow-sm">
                <div className="text-[20px] font-extrabold tabular-nums" style={{ color: SANCTUARY.accent }}>+{points}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>points</div>
              </div>
              <div className="flex-1 rounded-2xl border border-white bg-white/85 py-3 shadow-sm">
                <div className="text-[20px] font-extrabold">🔥 {result.streak}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SANCTUARY.inkFaint }}>day streak</div>
              </div>
            </div>
            {result.leveled_up && (
              <div
                className="wl-spring rounded-2xl py-3 text-[15px] font-extrabold text-white shadow-md"
                style={{ background: accentGradient(color) }}
              >
                ⭐ Level {result.level} — {tierLabel(result.level)}!
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />
      <div className="relative w-full max-w-sm pt-6">
        <PrimaryButton color={color} onClick={onDone}>
          {result?.day_complete ? 'Finish the day 🎉' : 'Back to my plan'}
        </PrimaryButton>
      </div>
    </div>
  )
}

const CONFETTI = Array.from({ length: 18 }).map((_, i) => {
  // Warm Sanctuary confetti — violet/rose-led with a couple of joyful accents.
  const colors = [SANCTUARY.accent, SANCTUARY.accent2, '#c084fc', '#f0abfc', '#10b981', '#fbbf24']
  return {
    left: `${(i * 5.6 + 4) % 96}%`,
    color: colors[i % colors.length],
    delay: `${(i % 5) * 120}ms`,
    dur: `${1400 + (i % 4) * 300}ms`,
  }
})

// ── Styles (keyframes scoped to the player) ───────────────────────────────────
// Brand-agnostic motion mechanics also live in styles.css (`wl-*`); these
// `wf-*` helpers are the small interaction primitives kept inline with the
// component for locality.

function WellnessStyles() {
  return (
    <style>{`
      .wf-press { will-change: transform; }
      .wf-press:active { transform: scale(0.97); }
      @keyframes wfShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
      .wf-shake { animation: wfShake 0.4s ease; }
      @keyframes wfFlame { 0%,100%{transform:scale(1) rotate(-2deg)} 50%{transform:scale(1.12) rotate(2deg)} }
      .wf-flame { animation: wfFlame 1.6s ease-in-out infinite; display:inline-block; }
      @keyframes wfConfetti { 0%{transform:translateY(-10px) rotate(0);opacity:1} 100%{transform:translateY(110vh) rotate(540deg);opacity:0} }
      .wf-confetti { animation: wfConfetti linear infinite; }
      @keyframes wfSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .wf-sheet-in { animation: wfSheetIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
      @media (prefers-reduced-motion: reduce) {
        .wf-shake, .wf-flame, .wf-confetti, .wf-sheet-in { animation: none !important; }
        .wf-press:active { transform: none; }
      }
    `}</style>
  )
}
