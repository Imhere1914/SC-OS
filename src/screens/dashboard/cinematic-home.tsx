import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BankIcon,
  Briefcase01Icon,
  BubbleChatIcon,
  Calendar01Icon,
  CalendarAdd01Icon,
  Chat01Icon,
  CoinsDollarIcon,
  DollarCircleIcon,
  Fire03Icon,
  FlowSquareIcon,
  Globe02Icon,
  ImageAdd01Icon,
  InvoiceIcon,
  Mail01Icon,
  Money01Icon,
  PipelineIcon,
  Settings02Icon,
  Share04Icon,
  SparklesIcon,
  UserAdd01Icon,
  UserGroupIcon,
  UserSearch01Icon,
  BarChartIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cinema, type CinemaPalette } from '@/lib/brand-cinema'
import { cn } from '@/lib/utils'

// ── Types (mirror mission-control's response shape) ───────────────────────────

interface ColdDealItem {
  id: string
  title: string
  stage: string
  days_since_update: number
}

interface AppointmentItem {
  id: string
  title: string
  contact_name: string | null
  start_time: string
  status: string
}

interface MissionControlData {
  urgent: {
    overdue_invoices: { count: number; total_cents: number }
    bills_due_this_week: { count: number; total_cents: number }
    cold_deals: { count: number; items: ColdDealItem[] }
    unread_conversations: number
  }
  today: {
    appointments: AppointmentItem[]
    tasks_due: number
  }
  momentum: {
    new_contacts_this_week: number
    revenue_this_month_cents: number
    deals_won_this_month: number
    invoices_paid_this_month: number
  }
  pipeline: {
    total_open_deals: number
    total_pipeline_value_cents: number
    by_stage: { stage: string; count: number; value_cents: number }[]
  }
  brand: string
  generated_at: string
}

interface OrchestratorStatusData {
  config: { enabled: boolean; interval_hours: number; last_run_at?: string }
  last_run: { started_at: string } | null
  pending_count: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

// ── Procedural cover art ────────────────────────────────────────────────────────
//
// Each module poster gets a UNIQUE but on-brand cover. We derive a small
// deterministic hash from the module key, map it to a hue OFFSET (±~26°) that is
// applied on top of the brand accent's own hue — so every poster lands inside the
// brand's colour family (SC blue/cyan, HFM violet/magenta) yet is visibly distinct
// from its neighbours. The hash also picks the pattern (dots / grid / rays) and
// the blob placement, so no two covers feel identical.

/** Stable 32-bit-ish hash → small non-negative int. djb2 variant. */
function hashKey(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Hex → {h,s,l}. Assumes a 6-digit #rrggbb. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export interface PosterArt {
  /** Full CSS background stack for the cover (layered mesh + glow + pattern). */
  background: string
  /** Tint used for the watermark glyph + footer accent — on-brand, per-module hue. */
  tint: string
  /** Box-shadow glow colour for the card. */
  glow: string
}

/**
 * Build a deterministic, on-brand cover for a module.
 *
 * Hue: brand accent hue + a per-module offset in [-26°, +26°]. SC's accent sits
 * in the blue/cyan band, HFM's in the violet/magenta band — clamping the offset
 * keeps every poster unmistakably in-family while making each one its own colour.
 */
function posterArt(moduleKey: string, palette: CinemaPalette): PosterArt {
  const hash = hashKey(moduleKey)
  const base = hexToHsl(palette.accent)
  const base2 = hexToHsl(palette.accent2)

  // Per-module hue offset, deterministic, within a tight ±26° band.
  const offset = ((hash % 53) - 26) // -26..+26
  const h1 = (base.h + offset + 360) % 360
  const h2 = (base2.h + offset * 0.6 + 360) % 360

  const c1 = `hsl(${h1}, ${Math.min(92, base.s + 6)}%, 58%)`
  const c2 = `hsl(${h2}, ${Math.min(90, base2.s + 4)}%, 56%)`
  const deep = `hsl(${h1}, 60%, 12%)`
  const tint = `hsl(${h1}, 88%, 66%)`

  // Blob placement varies per module (deterministic).
  const bx = 18 + (hash % 60) // 18..77
  const by = 8 + ((hash >> 3) % 34) // 8..41
  const bx2 = 12 + ((hash >> 5) % 56)

  // Pattern: 0 dots, 1 grid, 2 rays — tasteful, low-opacity overlay.
  const patternKind = hash % 3
  let pattern: string
  if (patternKind === 0) {
    // dot field
    pattern = `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px) 0 0 / 13px 13px`
  } else if (patternKind === 1) {
    // fine grid
    pattern =
      `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 100% 18px,` +
      `linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 18px 100%`
  } else {
    // soft rays
    pattern =
      `repeating-conic-gradient(from ${(hash % 90)}deg at 80% -10%, rgba(255,255,255,0.05) 0deg 6deg, transparent 6deg 18deg)`
  }

  const background = [
    pattern,
    `radial-gradient(120% 90% at ${bx}% ${by}%, color-mix(in srgb, ${c1} 70%, transparent), transparent 60%)`,
    `radial-gradient(100% 80% at ${bx2}% 86%, color-mix(in srgb, ${c2} 52%, transparent), transparent 62%)`,
    `linear-gradient(150deg, color-mix(in srgb, ${deep} 70%, ${palette.surface}), ${palette.baseBg} 88%)`,
  ].join(',')

  return { background, tint, glow: c1 }
}

// ── Reusable horizontal Row carousel ──────────────────────────────────────────

interface RowProps {
  title: string
  seeAll?: string
  delay?: number
  children: React.ReactNode
}

function Row({ title, seeAll, delay = 0, children }: RowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = () => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 280), behavior: 'smooth' })
  }

  return (
    <section
      className="cine-enter group/row relative"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-white/95">{title}</h2>
        {seeAll && (
          <Link
            to={seeAll as '/'}
            className="text-[12px] font-medium text-white/65 transition-colors hover:text-white/80"
          >
            See all →
          </Link>
        )}
      </div>

      <div className="relative">
        {/* Edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 transition-opacity duration-200"
          style={{
            opacity: canLeft ? 1 : 0,
            background: 'linear-gradient(90deg, var(--cine-base, #0a0a12), transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 transition-opacity duration-200"
          style={{
            opacity: canRight ? 1 : 0,
            background: 'linear-gradient(270deg, var(--cine-base, #0a0a12), transparent)',
          }}
        />

        {/* Arrow controls (hover-reveal, desktop) */}
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 p-2 text-white opacity-0 backdrop-blur transition-all duration-200 hover:bg-black/75 group-hover/row:opacity-100 md:flex"
          style={{ pointerEvents: canLeft ? 'auto' : 'none', visibility: canLeft ? 'visible' : 'hidden' }}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
        </button>
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 p-2 text-white opacity-0 backdrop-blur transition-all duration-200 hover:bg-black/75 group-hover/row:opacity-100 md:flex"
          style={{ pointerEvents: canRight ? 'auto' : 'none', visibility: canRight ? 'visible' : 'hidden' }}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>

        <div
          ref={trackRef}
          onScroll={update}
          className="cine-scroll flex gap-3 overflow-x-auto scroll-smooth px-1 pb-2"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

// Shared card chrome — dark cinematic surface, springy hover.
const CARD_BASE =
  'group/card relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.06]'

// ── Attention card ─────────────────────────────────────────────────────────────

function AttentionCard({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: string
  title: string
  subtitle: string
  href: string
}) {
  return (
    <Link
      to={href as '/'}
      className={CARD_BASE}
      style={{
        width: 240,
        scrollSnapAlign: 'start',
        background:
          'linear-gradient(150deg, color-mix(in srgb, #ef4444 26%, #16121a), #14101a 75%)',
        boxShadow: '0 8px 30px -10px rgba(239,68,68,0.35)',
      }}
    >
      <div className="flex h-[136px] flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{icon}</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="cine-pulse-dot absolute inline-flex h-full w-full rounded-full bg-[#ef4444]" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
          </span>
        </div>
        <div>
          <p className="text-[14px] font-semibold leading-tight text-white">{title}</p>
          <p className="mt-1 line-clamp-2 text-[12px] text-white/75">{subtitle}</p>
        </div>
      </div>
    </Link>
  )
}

// ── Today / appointment card ───────────────────────────────────────────────────

function AppointmentCard({ appt }: { appt: AppointmentItem }) {
  return (
    <Link
      to={'/appointments' as '/'}
      className={CARD_BASE}
      style={{
        width: 220,
        scrollSnapAlign: 'start',
        background: 'linear-gradient(150deg, #1a1726, #121019 80%)',
      }}
    >
      <div className="flex h-[136px] flex-col justify-between p-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/95">
          {fmtTime(appt.start_time)}
        </span>
        <div>
          <p className="line-clamp-2 text-[14px] font-semibold leading-tight text-white">
            {appt.title}
          </p>
          {appt.contact_name && (
            <p className="mt-1 truncate text-[12px] text-white/95">{appt.contact_name}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

function ClearScheduleCard() {
  return (
    <Link
      to={'/appointments' as '/'}
      className={CARD_BASE}
      style={{
        width: 280,
        scrollSnapAlign: 'start',
        background: 'linear-gradient(150deg, #14211c, #101814 80%)',
      }}
    >
      <div className="flex h-[136px] flex-col justify-center gap-1 p-5">
        <span className="text-2xl">🌿</span>
        <p className="text-[15px] font-semibold text-white">Clear schedule</p>
        <p className="text-[12px] text-white/75">Enjoy it — nothing on the calendar today.</p>
      </div>
    </Link>
  )
}

// ── Metric tile ─────────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  pct,
  color,
  href,
  icon,
  delay,
}: {
  label: string
  value: string
  sub: string
  pct: number
  color: string
  href: string
  icon: typeof Money01Icon
  delay: number
}) {
  return (
    <Link
      to={href as '/'}
      className={CARD_BASE}
      style={{
        width: 220,
        scrollSnapAlign: 'start',
        background: `linear-gradient(150deg, color-mix(in srgb, ${color} 22%, #15121c), #121019 78%)`,
      }}
    >
      <div className="flex h-[150px] flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: color, boxShadow: `0 4px 14px -4px ${color}` }}
          >
            <HugeiconsIcon icon={icon} size={17} strokeWidth={1.9} />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/65">
            {label}
          </span>
        </div>
        <div>
          <p className="text-[26px] font-bold leading-none tabular-nums text-white">{value}</p>
          <p className="mt-1.5 text-[11px] text-white/95">{sub}</p>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="cine-bar-fill h-full rounded-full"
              style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: color, animationDelay: `${delay}ms` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Action card ─────────────────────────────────────────────────────────────────

function ActionCard({
  label,
  emoji,
  href,
  palette,
}: {
  label: string
  emoji: string
  href: string
  palette: CinemaPalette
}) {
  // Bold brand-gradient cover + oversized watermark glyph.
  const art = posterArt(label, palette)
  return (
    <Link
      to={href as '/'}
      className={cn(CARD_BASE, 'cine-poster')}
      style={{
        width: 168,
        scrollSnapAlign: 'start',
        boxShadow: `0 10px 28px -14px ${art.glow}`,
        ['--poster-glow' as string]: art.glow,
        background: art.background,
      }}
    >
      <div className="relative flex h-[130px] flex-col items-start justify-between p-4">
        <span
          className="cine-poster-mark pointer-events-none absolute -bottom-4 -right-2 select-none text-[80px] leading-none"
          aria-hidden
        >
          {emoji}
        </span>
        <span
          className="relative flex h-11 w-11 items-center justify-center rounded-xl text-2xl text-white shadow-lg"
          style={{
            background: `color-mix(in srgb, ${art.glow} 52%, rgba(10,12,20,0.5))`,
            boxShadow: `0 4px 16px -4px ${art.glow}`,
          }}
        >
          {emoji}
        </span>
        <p className="relative text-[13px] font-semibold leading-tight text-white">{label}</p>
      </div>
    </Link>
  )
}

// ── Module cover-art poster (Netflix title card) ────────────────────────────────
//
// A 16:10-ish landscape card whose whole surface is bespoke procedural cover art
// (mesh + glow + pattern + a large faded watermark glyph), with a gradient-scrim
// footer carrying the title + a one-line descriptor that brightens on hover.

function Poster({ module: m, palette }: { module: ModuleDef; palette: CinemaPalette }) {
  const art = posterArt(m.label, palette)
  return (
    <Link
      to={m.href as '/'}
      className={cn(CARD_BASE, 'cine-poster')}
      style={{
        width: 264,
        scrollSnapAlign: 'start',
        boxShadow: `0 10px 30px -14px ${art.glow}`,
        ['--poster-glow' as string]: art.glow,
      }}
    >
      <div className="relative h-[164px] w-full" style={{ background: art.background }}>
        {/* Large faded watermark glyph */}
        <span
          className="cine-poster-mark pointer-events-none absolute -right-3 -top-4 select-none text-[112px] leading-none"
          style={{ color: art.tint }}
          aria-hidden
        >
          {m.glyph}
        </span>
        {/* Soft top glow */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 50% at 78% 8%, color-mix(in srgb, ${art.glow} 38%, transparent), transparent 60%)`,
          }}
        />
        {/* Crisp brand icon chip */}
        <span
          className="absolute left-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg backdrop-blur-sm"
          style={{
            background: `color-mix(in srgb, ${art.glow} 50%, rgba(10,12,20,0.55))`,
            boxShadow: `0 4px 14px -4px ${art.glow}`,
          }}
        >
          <HugeiconsIcon icon={m.icon} size={17} strokeWidth={1.9} />
        </span>
        {/* Gradient-scrim title footer */}
        <div
          className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-10"
          style={{
            background:
              'linear-gradient(0deg, rgba(6,8,14,0.92) 8%, rgba(6,8,14,0.55) 48%, transparent 100%)',
          }}
        >
          <p className="text-[14px] font-semibold leading-tight text-white">{m.label}</p>
          <p className="cine-poster-desc mt-0.5 truncate text-[11.5px] text-white/75">
            {m.desc}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ── Orchestrator / jump-back card ───────────────────────────────────────────────

function OrchestratorCard({ pending, palette }: { pending: number; palette: CinemaPalette }) {
  return (
    <Link
      to={'/orchestrator' as '/'}
      className={CARD_BASE}
      style={{
        width: 260,
        scrollSnapAlign: 'start',
        background: `linear-gradient(150deg, color-mix(in srgb, ${palette.accent} 30%, ${palette.surface}), ${palette.baseBg} 80%)`,
      }}
    >
      <div className="flex h-[136px] flex-col justify-between p-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{
            background: palette.gradient,
            boxShadow: `0 4px 16px -4px ${palette.glow}`,
          }}
        >
          <HugeiconsIcon icon={AiMagicIcon} size={18} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-white">Hermes Ops</p>
          <p className="mt-0.5 text-[12px] text-white/75">
            {pending > 0
              ? `${pending} proposal${pending !== 1 ? 's' : ''} awaiting review`
              : 'All clear — watching your business'}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ── Static data: quick actions + explore modules ────────────────────────────────

const QUICK_ACTIONS: { label: string; emoji: string; href: string }[] = [
  { label: 'New Contact', emoji: '👤', href: '/contacts' },
  { label: 'New Deal', emoji: '💰', href: '/deals' },
  { label: 'New Invoice', emoji: '🧾', href: '/payments' },
  { label: 'New Appointment', emoji: '📅', href: '/appointments' },
  { label: 'Send Campaign', emoji: '📧', href: '/campaigns' },
  { label: 'Ask Hermes', emoji: '🤖', href: '/chat' },
]

interface ModuleDef {
  label: string
  icon: typeof Money01Icon
  href: string
  /** Big faded watermark glyph + one-line Netflix-style descriptor. */
  glyph: string
  desc: string
  brandOnly?: 'hfm' | 'sc'
}

const EXPLORE_MODULES: ModuleDef[] = [
  { label: 'Finance', icon: CoinsDollarIcon, href: '/finance', glyph: '💰', desc: 'Cashflow, books & profit at a glance' },
  { label: 'Contacts', icon: UserGroupIcon, href: '/contacts', glyph: '👥', desc: 'Your relationships, organized' },
  { label: 'Deals', icon: DollarCircleIcon, href: '/deals', glyph: '🤝', desc: 'Track every opportunity to close' },
  { label: 'Conversations', icon: Chat01Icon, href: '/conversations', glyph: '💬', desc: 'One inbox for every channel' },
  { label: 'Appointments', icon: Calendar01Icon, href: '/appointments', glyph: '📅', desc: 'Your schedule, beautifully kept' },
  { label: 'Campaigns', icon: Mail01Icon, href: '/campaigns', glyph: '📧', desc: 'Reach your audience at scale' },
  { label: 'Projects', icon: Briefcase01Icon, href: '/projects', glyph: '📁', desc: 'Deliver client work on time' },
  { label: 'Payments', icon: Money01Icon, href: '/payments', glyph: '🧾', desc: 'Invoices in, money collected' },
  { label: 'Pipeline', icon: PipelineIcon, href: '/pipeline', glyph: '📈', desc: 'See your revenue taking shape' },
  { label: 'Team Chat', icon: BubbleChatIcon, href: '/team-chat', glyph: '🗨️', desc: 'Where your team works together' },
  { label: 'Social', icon: Share04Icon, href: '/social', glyph: '📣', desc: 'Post everywhere, all at once' },
  { label: 'Media Studio', icon: ImageAdd01Icon, href: '/media', glyph: '🎨', desc: 'Generate stunning brand visuals' },
  { label: 'Site Studio', icon: Globe02Icon, href: '/site-studio', glyph: '🌐', desc: 'Launch pages without code' },
  { label: 'Daily Wellness', icon: Fire03Icon, href: '/daily-wellness', glyph: '🔥', desc: 'Your daily ritual & momentum', brandOnly: 'hfm' },
  { label: 'Prospecting', icon: UserSearch01Icon, href: '/prospecting', glyph: '🔭', desc: 'Find your next best customer', brandOnly: 'sc' },
  { label: 'Automations', icon: FlowSquareIcon, href: '/automations', glyph: '⚡', desc: 'Let the busywork run itself' },
  { label: 'Reports', icon: BarChartIcon, href: '/reports', glyph: '📊', desc: 'Know your numbers cold' },
  { label: 'Banking', icon: BankIcon, href: '/banking', glyph: '🏦', desc: 'Accounts & balances in sync' },
  { label: 'Settings', icon: Settings02Icon, href: '/settings', glyph: '⚙️', desc: 'Tune your workspace' },
]

// ── Hero priority logic ─────────────────────────────────────────────────────────

interface HeroPlan {
  headline: string
  ctaLabel: string
  ctaHref: string
}

function planHero(
  data: MissionControlData | undefined,
  pending: number,
): HeroPlan {
  const urgentCount = data
    ? data.urgent.overdue_invoices.count +
      data.urgent.bills_due_this_week.count +
      data.urgent.cold_deals.count
    : 0
  const apptCount = data?.today.appointments.length ?? 0

  if (urgentCount > 0) {
    return {
      headline: `${urgentCount} thing${urgentCount !== 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} your attention`,
      ctaLabel: 'Review now',
      ctaHref: data && data.urgent.overdue_invoices.count > 0 ? '/payments' : '/deals',
    }
  }
  if (apptCount > 0) {
    return {
      headline: `You have ${apptCount} appointment${apptCount !== 1 ? 's' : ''} today`,
      ctaLabel: 'View schedule',
      ctaHref: '/appointments',
    }
  }
  if (pending > 0) {
    return {
      headline: `Hermes has ${pending} suggestion${pending !== 1 ? 's' : ''} for you`,
      ctaLabel: 'See proposals',
      ctaHref: '/orchestrator',
    }
  }
  return {
    headline: 'Your business, at a glance',
    ctaLabel: 'Explore',
    ctaHref: '/finance',
  }
}

// ── CinematicHome ───────────────────────────────────────────────────────────────

export function CinematicHome() {
  const brand = useBrand()
  const c = cinema(brand.id)
  const accent = c.accent
  const soft = c.motion === 'organic' // HFM: warmer/softer/rounder bloom
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data } = useQuery<MissionControlData | null>({
    queryKey: ['mission-control', brand.id],
    queryFn: async () => {
      const r = await fetch(`/api/mission-control?brand=${brand.id}`)
      if (!r.ok) return null
      return r.json() as Promise<MissionControlData>
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const { data: orch } = useQuery<OrchestratorStatusData | null>({
    queryKey: ['orchestrator', 'status', brand.id],
    queryFn: async () => {
      const r = await fetch(`/api/orchestrator/status?brand=${brand.id}`)
      if (!r.ok) return null
      return r.json() as Promise<OrchestratorStatusData>
    },
    refetchInterval: 60_000,
    retry: false,
  })

  const pending = orch?.pending_count ?? 0
  const safe = data ?? undefined
  const hero = planHero(safe, pending)

  const urgentCount = safe
    ? safe.urgent.overdue_invoices.count +
      safe.urgent.bills_due_this_week.count +
      safe.urgent.cold_deals.count
    : 0

  // Metric scaling — use simple proportional bars vs. a soft reference ceiling.
  const revenue = safe?.momentum.revenue_this_month_cents ?? 0
  const openPipeline = safe?.pipeline.total_pipeline_value_cents ?? 0
  const pipelineMax = Math.max(revenue, openPipeline, 1)

  const modules = EXPLORE_MODULES.filter(
    (m) => !m.brandOnly || m.brandOnly === brand.id,
  )

  // "Jump back in" reuses real module defs so they get the same cover art.
  const jumpHrefs = ['/pipeline', '/finance', '/conversations']
  const jumpBack = jumpHrefs
    .map((h) => EXPLORE_MODULES.find((m) => m.href === h))
    .filter((m): m is ModuleDef => Boolean(m))

  let rowDelay = 220
  const nextDelay = () => {
    const d = rowDelay
    rowDelay += 90
    return d
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: c.baseBg, colorScheme: 'dark', '--cine-base': c.baseBg } as React.CSSProperties}
    >
      {/* ── Hero billboard ─────────────────────────────────────────────────── */}
      <div className="relative isolate min-h-[42vh] w-full overflow-hidden">
        {/* Layered cinematic backdrop — HFM blooms warmer/softer, SC sharper. */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `
              radial-gradient(120% 80% at 78% 0%, color-mix(in srgb, ${accent} ${soft ? 38 : 44}%, transparent), transparent ${soft ? 62 : 52}%),
              radial-gradient(90% 70% at 12% 30%, color-mix(in srgb, ${c.accent2} ${soft ? 22 : 26}%, transparent), transparent ${soft ? 66 : 58}%),
              linear-gradient(180deg, color-mix(in srgb, ${c.surface} 80%, ${accent}) 0%, ${c.surface} 55%, ${c.baseBg} 100%)
            `,
          }}
        />
        {/* Drifting glow blobs — SC tighter/electric, HFM larger/softer bloom. */}
        <div
          className="cine-aurora-a absolute -z-10 rounded-full blur-3xl"
          style={{
            top: '-20%',
            right: '-8%',
            height: soft ? '70vh' : '58vh',
            width: soft ? '70vh' : '58vh',
            background: `radial-gradient(circle, color-mix(in srgb, ${accent} ${soft ? 48 : 58}%, transparent), transparent 70%)`,
          }}
        />
        <div
          className="cine-aurora-b absolute -z-10 rounded-full blur-3xl"
          style={{
            bottom: '-25%',
            left: '-5%',
            height: soft ? '58vh' : '48vh',
            width: soft ? '58vh' : '48vh',
            background: `radial-gradient(circle, color-mix(in srgb, ${c.blobs[2]} ${soft ? 42 : 46}%, transparent), transparent 70%)`,
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 30%, transparent 50%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        <div className="mx-auto flex min-h-[42vh] w-full max-w-[1280px] flex-col justify-end px-6 py-10 md:px-10 md:py-14">
          <div className="cine-enter max-w-2xl" style={{ animationDelay: '40ms' }}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75">
              {brand.name}
            </p>
            <p className="mt-3 text-[15px] font-medium text-white/95">
              {greeting(now)}
            </p>
            <h1 className="mt-1 text-[34px] font-bold leading-[1.05] tracking-tight text-white md:text-[52px]">
              {hero.headline}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={hero.ctaHref as '/'}
                className={cn(
                  'px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg transition-transform duration-150 hover:scale-[1.03]',
                  soft ? 'rounded-2xl' : 'rounded-xl',
                )}
                style={{
                  background: c.gradient,
                  boxShadow: soft
                    ? `0 10px 34px -8px color-mix(in srgb, ${c.glow} 80%, transparent)`
                    : `0 8px 24px -8px ${c.glow}`,
                }}
              >
                {hero.ctaLabel} →
              </Link>
              <Link
                to={'/chat' as '/'}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-[14px] font-semibold text-white/95 backdrop-blur transition-colors duration-150 hover:bg-white/10"
              >
                <HugeiconsIcon icon={SparklesIcon} size={15} />
                Ask Hermes
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content rows ───────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1280px] space-y-8 px-5 py-8 md:px-9">

        {/* Needs your attention — only if urgent */}
        {safe && urgentCount > 0 && (
          <Row title="Needs your attention" delay={nextDelay()}>
            {safe.urgent.overdue_invoices.count > 0 && (
              <AttentionCard
                icon="🔴"
                title={`${safe.urgent.overdue_invoices.count} overdue invoice${safe.urgent.overdue_invoices.count !== 1 ? 's' : ''}`}
                subtitle={`$${fmtCents(safe.urgent.overdue_invoices.total_cents)} outstanding`}
                href="/payments"
              />
            )}
            {safe.urgent.cold_deals.count > 0 && (
              <AttentionCard
                icon="🧊"
                title={`${safe.urgent.cold_deals.count} deal${safe.urgent.cold_deals.count !== 1 ? 's' : ''} going cold`}
                subtitle={
                  safe.urgent.cold_deals.items.slice(0, 2).map((d) => d.title).join(', ') ||
                  'No recent activity'
                }
                href="/deals"
              />
            )}
            {safe.urgent.bills_due_this_week.count > 0 && (
              <AttentionCard
                icon="📋"
                title={`${safe.urgent.bills_due_this_week.count} bill${safe.urgent.bills_due_this_week.count !== 1 ? 's' : ''} due`}
                subtitle={`$${fmtCents(safe.urgent.bills_due_this_week.total_cents)} this week`}
                href="/bills"
              />
            )}
            {pending > 0 && (
              <AttentionCard
                icon="🤖"
                title={`${pending} Hermes proposal${pending !== 1 ? 's' : ''}`}
                subtitle="Awaiting your review"
                href="/orchestrator"
              />
            )}
          </Row>
        )}

        {/* Today */}
        <Row title="Today" seeAll="/appointments" delay={nextDelay()}>
          {safe && safe.today.appointments.length > 0 ? (
            safe.today.appointments.map((a) => <AppointmentCard key={a.id} appt={a} />)
          ) : (
            <ClearScheduleCard />
          )}
        </Row>

        {/* Your business — metrics */}
        {safe && (
          <Row title="Your business" delay={nextDelay()}>
            <MetricTile
              label="Revenue"
              value={`$${fmtCents(safe.momentum.revenue_this_month_cents)}`}
              sub="this month"
              pct={(revenue / pipelineMax) * 100}
              color="#22c55e"
              icon={Money01Icon}
              href="/payments"
              delay={300}
            />
            <MetricTile
              label="Open Pipeline"
              value={`$${fmtCents(safe.pipeline.total_pipeline_value_cents)}`}
              sub={`${safe.pipeline.total_open_deals} active deal${safe.pipeline.total_open_deals !== 1 ? 's' : ''}`}
              pct={(openPipeline / pipelineMax) * 100}
              color="#f97316"
              icon={PipelineIcon}
              href="/deals"
              delay={380}
            />
            <MetricTile
              label="New Contacts"
              value={String(safe.momentum.new_contacts_this_week)}
              sub="this week"
              pct={Math.min(100, safe.momentum.new_contacts_this_week * 10)}
              color="#0ea5e9"
              icon={UserGroupIcon}
              href="/contacts"
              delay={460}
            />
            <MetricTile
              label="Deals Won"
              value={String(safe.momentum.deals_won_this_month)}
              sub="this month"
              pct={Math.min(100, safe.momentum.deals_won_this_month * 20)}
              color="#8b5cf6"
              icon={DollarCircleIcon}
              href="/deals"
              delay={540}
            />
          </Row>
        )}

        {/* Quick actions — always */}
        <Row title="Quick actions" delay={nextDelay()}>
          {QUICK_ACTIONS.map((qa) => (
            <ActionCard
              key={qa.label}
              label={qa.label}
              emoji={qa.emoji}
              href={qa.href}
              palette={c}
            />
          ))}
        </Row>

        {/* Jump back in */}
        <Row title="Jump back in" delay={nextDelay()}>
          <OrchestratorCard pending={pending} palette={c} />
          {jumpBack.map((m) => (
            <Poster key={m.href} module={m} palette={c} />
          ))}
        </Row>

        {/* Explore — all modules, always */}
        <Row title="Explore" delay={nextDelay()}>
          {modules.map((m) => (
            <Poster key={m.href} module={m} palette={c} />
          ))}
        </Row>

      </div>
    </div>
  )
}

// Keep these valid exports available for consumers (mirror mission-control).
export { UserAdd01Icon, InvoiceIcon, CalendarAdd01Icon }
