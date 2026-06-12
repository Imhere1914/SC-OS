import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  BarChartIcon,
  Briefcase01Icon,
  BubbleChatIcon,
  Calendar01Icon,
  Chat01Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  FlowSquareIcon,
  Layout01Icon,
  ImageAdd01Icon,
  Mail01Icon,
  Menu01Icon,
  Money01Icon,
  Moon02Icon,
  Search01Icon,
  Settings02Icon,
  Share04Icon,
  ChartLineData01Icon,
  StarIcon,
  Sun03Icon,
  TaskEdit01Icon,
  UserGroupIcon,
  DollarCircleIcon,
  FilterHorizontalIcon,
  SentIcon,
  DocumentValidationIcon,
  ContractsIcon,
  MegaphoneIcon,
  CustomerService01Icon,
  Quiz03Icon,
  FolderLibraryIcon,
  Activity01Icon,
  Video01Icon,
  CoinsDollarIcon,
  SchoolIcon,
  Fire03Icon,
  Logout01Icon,
  SparklesIcon,
  Globe02Icon,
  UserSearch01Icon,
  GridIcon,
  Mic01Icon,
} from '@hugeicons/core-free-icons'
import { useQuery } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { cinema } from '@/lib/brand-cinema'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { NotificationsBell } from '@/components/NotificationsBell'
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcuts'
import { PushOptIn } from '@/components/PushOptIn'
import { LoginScreen } from '@/components/LoginScreen'
import { AmbientBackground } from '@/components/AmbientBackground'
import { AppLauncher, useAppLauncher } from '@/components/AppLauncher'
import { HermesFloat } from '@/components/HermesFloat'

// ── Auth state ─────────────────────────────────────────────────────────────────
type AuthMe = { authenticated: boolean; auth_enabled: boolean; email?: string }

function useAuthMe() {
  return useQuery<AuthMe>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) throw new Error('Auth check failed')
      return res.json()
    },
    // Poll so an expired session flips the UI to the login screen within a minute
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export type NavItem = {
  to: string
  label: string
  icon: typeof Chat01Icon
}

/** Streamlined sidebar nav — essentials only. Everything else via App Launcher (⌘/). */
export function navItems(brandId: string): { section: string; items: NavItem[] }[] {
  const contactsLabel = brandId === 'hfm' ? 'Patients' : 'Contacts'
  const projectsLabel = brandId === 'hfm' ? 'Programs' : 'Projects'
  return [
    {
      section: '',
      items: [
        { to: '/', label: 'Dashboard', icon: DashboardSquare01Icon },
        { to: '/highlights', label: 'Highlights', icon: StarIcon },
        { to: '/voice', label: 'Voice Capture', icon: Mic01Icon },
      ],
    },
    {
      section: 'Business',
      items: [
        { to: '/conversations', label: 'Inbox', icon: Chat01Icon },
        { to: '/contacts', label: contactsLabel, icon: UserGroupIcon },
        { to: '/appointments', label: 'Appointments', icon: Calendar01Icon },
        { to: '/deals', label: 'Deals', icon: DollarCircleIcon },
        { to: '/agents', label: 'Agent Swarm', icon: AiBrain01Icon },
        { to: '/team-chat', label: 'Team Chat', icon: BubbleChatIcon },
      ],
    },
    {
      section: 'Marketing',
      items: [
        { to: '/social', label: 'Social', icon: Share04Icon },
        { to: '/campaigns', label: 'Campaigns', icon: Mail01Icon },
        { to: '/media', label: 'Media Studio', icon: ImageAdd01Icon },
      ],
    },
    {
      section: 'Manage',
      items: [
        { to: '/finance', label: 'Finance', icon: CoinsDollarIcon },
        { to: '/projects', label: projectsLabel, icon: Briefcase01Icon },
      ],
    },
  ]
}

/** Full module list — used by App Launcher and Command Palette */
export function allNavItems(brandId: string): NavItem[] {
  const contactsLabel = brandId === 'hfm' ? 'Patients' : 'Contacts'
  const projectsLabel = brandId === 'hfm' ? 'Programs' : 'Projects'
  return [
    { to: '/', label: 'Dashboard', icon: DashboardSquare01Icon },
    { to: '/chat', label: 'Assistant', icon: Chat01Icon },
    { to: '/highlights', label: 'Highlights', icon: StarIcon },
    { to: '/activity', label: 'Activity Feed', icon: Activity01Icon },
    { to: '/knowledge', label: 'Knowledge Vault', icon: AiBrain01Icon },
    { to: '/voice', label: 'Voice Capture', icon: Mic01Icon },
    { to: '/agents', label: 'Agent Swarm', icon: AiBrain01Icon },
    { to: '/team-chat', label: 'Team Chat', icon: BubbleChatIcon },
    { to: '/conversations', label: 'Inbox', icon: Chat01Icon },
    { to: '/contacts', label: contactsLabel, icon: UserGroupIcon },
    { to: '/appointments', label: 'Appointments', icon: Calendar01Icon },
    { to: '/video-calls', label: 'Video Calls', icon: Video01Icon },
    { to: '/scheduling', label: 'Scheduling', icon: Calendar01Icon },
    { to: '/forms', label: 'Forms', icon: TaskEdit01Icon },
    { to: '/surveys', label: 'Surveys', icon: Quiz03Icon },
    { to: '/training', label: 'Training', icon: SchoolIcon },
    { to: '/daily-wellness', label: 'Daily Wellness', icon: Fire03Icon },
    { to: '/social', label: 'Social', icon: Share04Icon },
    { to: '/social-intel', label: 'Social Intelligence', icon: ChartLineData01Icon },
    { to: '/prospecting', label: 'Prospecting', icon: UserSearch01Icon },
    { to: '/campaigns', label: 'Campaigns', icon: Mail01Icon },
    { to: '/broadcast', label: 'Broadcast', icon: MegaphoneIcon },
    { to: '/sequences', label: 'Sequences', icon: SentIcon },
    { to: '/segments', label: 'Segments', icon: FilterHorizontalIcon },
    { to: '/calendar', label: 'Content Calendar', icon: Calendar01Icon },
    { to: '/pages', label: 'Pages', icon: Layout01Icon },
    { to: '/site-studio', label: 'Site Studio', icon: Globe02Icon },
    { to: '/templates', label: 'Templates', icon: Copy01Icon },
    { to: '/media', label: 'Media Studio', icon: ImageAdd01Icon },
    { to: '/finance', label: 'Finance', icon: CoinsDollarIcon },
    { to: '/documents', label: 'Documents', icon: FolderLibraryIcon },
    { to: '/tickets', label: 'Help Desk', icon: CustomerService01Icon },
    { to: '/projects', label: projectsLabel, icon: Briefcase01Icon },
    { to: '/deals', label: 'Deals', icon: DollarCircleIcon },
    { to: '/proposals', label: 'Proposals', icon: DocumentValidationIcon },
    { to: '/contracts', label: 'Contracts', icon: ContractsIcon },
    { to: '/automations', label: 'Automations', icon: FlowSquareIcon },
    { to: '/reports', label: 'Reports', icon: BarChartIcon },
    { to: '/settings', label: 'Settings', icon: Settings02Icon },
  ]
}

// ── Global search widget ───────────────────────────────────────────────────────
type SearchHit = { id: string; type: string; title: string; subtitle?: string; sub?: string; meta?: string; url?: string; link?: string }

function GlobalSearch() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 2) { setHits([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const brandParam = brand.id !== 'default' ? `&brand=${brand.id}` : ''
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${brandParam}`)
        const data = (await res.json()) as { results?: SearchHit[]; hits?: SearchHit[] }
        setHits(data.results ?? data.hits ?? [])
        setOpen(true)
        setIdx(0)
      } catch { /* ignore */ }
    }, 220)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, brand.id])

  const go = (hit: SearchHit) => {
    void navigate({ to: (hit.url ?? hit.link ?? '/') as '/' })
    setQuery('')
    setHits([])
    setOpen(false)
  }

  const TYPE_ICON: Record<string, typeof Chat01Icon> = {
    contact: UserGroupIcon, conversation: Chat01Icon, appointment: Calendar01Icon, invoice: Money01Icon,
  }

  return (
    <div className="relative mx-2.5 mb-3">
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, hits.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && hits[idx]) go(hits[idx])
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search…"
          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-7 pr-3 text-[11px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-1 shadow-2xl">
          {hits.map((hit, i) => {
            const Icon = TYPE_ICON[hit.type] ?? Search01Icon
            return (
              <button
                key={hit.id}
                onMouseDown={() => go(hit)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left',
                  i === idx ? 'bg-[var(--theme-accent-soft)]' : 'hover:bg-[var(--theme-hover)]',
                )}
              >
                <span className="shrink-0 text-[var(--theme-accent)]">
                  <HugeiconsIcon icon={Icon} size={12} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-[var(--theme-text)]">{hit.title}</p>
                  <p className="truncate text-[9px] text-[var(--theme-muted)]">{hit.subtitle ?? hit.sub ?? ''}</p>
                </div>
                <span className="ml-auto shrink-0 rounded border border-[var(--theme-border)] px-1 py-px text-[8px] capitalize text-[var(--theme-muted)]">{hit.type}</span>
              </button>
            )
          })}
        </div>
      )}
      {open && hits.length === 0 && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-xl">
          <p className="text-center text-[11px] text-[var(--theme-muted)]">No results for "{query}"</p>
        </div>
      )}
    </div>
  )
}

// ── System health status line ─────────────────────────────────────────────────
function SystemStatusLine() {
  const health = useQuery<boolean>({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error('Health check failed')
      return true
    },
    refetchInterval: 60_000,
    retry: false,
  })
  const degraded = health.isError
  const color = degraded ? 'var(--theme-danger)' : 'var(--theme-success)'
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
          style={{ background: color }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </span>
      <span className="truncate text-[9px] font-medium leading-tight text-[var(--theme-muted)]">
        {degraded ? 'Degraded' : 'All systems operational'}
      </span>
    </div>
  )
}

// ── Hermes presence orb ────────────────────────────────────────────────────────
function HermesOrb({ onNavigate }: { onNavigate?: () => void }) {
  const brand = useBrand()
  const c = cinema(brand.id)
  const { data } = useQuery<{ pending_count: number } | null>({
    queryKey: ['nav', 'orchestrator-status', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/orchestrator/status?brand=${brand.id}`)
      if (!res.ok) return null
      return res.json() as Promise<{ pending_count: number }>
    },
    refetchInterval: 60_000,
    retry: false,
  })
  const pending = data?.pending_count ?? 0

  return (
    <div
      className="mx-2.5 mb-3 flex items-center gap-2.5 rounded-xl border px-2.5 py-2"
      style={{
        borderColor: `color-mix(in srgb, ${c.accent} 16%, var(--theme-border))`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${c.accent} 9%, transparent), transparent 70%), var(--theme-card)`,
      }}
    >
      <Link
        to="/chat"
        onClick={onNavigate}
        aria-label="Open Hermes assistant"
        title="Talk to Hermes"
        data-motion={c.motion}
        className="cine-brandmark flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{
          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${c.accent} 55%, white), ${c.accent} 48%, ${c.accent2})`,
          boxShadow: `0 2px 12px color-mix(in srgb, ${c.glow} 45%, transparent)`,
          '--cine-glow': c.glow,
        } as React.CSSProperties}
      >
        <HugeiconsIcon icon={SparklesIcon} size={14} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-tight text-[var(--theme-text)]">Hermes</p>
        {pending > 0 ? (
          <Link
            to="/orchestrator"
            onClick={onNavigate}
            className="flex items-center gap-1 text-[10px] font-medium leading-tight hover:underline"
            style={{ color: 'var(--theme-warning)' }}
          >
            <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: 'var(--theme-warning)' }} />
            {pending} proposal{pending === 1 ? '' : 's'} waiting
          </Link>
        ) : (
          <p className="truncate text-[10px] leading-tight text-[var(--theme-muted)]">
            Watching your business
          </p>
        )}
      </div>
    </div>
  )
}

// ── Team Chat unread dot ──────────────────────────────────────────────────────
function TeamChatUnreadDot() {
  const brand = useBrand()
  const { data } = useQuery<number>({
    queryKey: ['nav', 'team-chat-unread', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/team-chat/channels?brand=${brand.id}`)
      if (!res.ok) return 0
      const d = (await res.json()) as { channels?: Array<{ unread_count?: number }> }
      return (d.channels ?? []).reduce((sum, ch) => sum + (ch.unread_count ?? 0), 0)
    },
    refetchInterval: 60_000,
    retry: false,
  })
  if (!data) return null
  return (
    <span
      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        background: 'var(--theme-accent)',
        boxShadow: '0 0 6px color-mix(in srgb, var(--theme-accent) 70%, transparent)',
      }}
    />
  )
}

function useUnreadCount(): number {
  const { data } = useQuery<number>({
    queryKey: ['nav', 'unread'],
    queryFn: async () => {
      const res = await fetch('/api/conversations')
      if (!res.ok) return 0
      const d = (await res.json()) as { conversations?: Array<{ unread: boolean }> }
      return (d.conversations ?? []).filter(c => c.unread).length
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
  return data ?? 0
}

function Sidebar({ onNavigate, onOpenLauncher }: { onNavigate?: () => void; onOpenLauncher?: () => void }) {
  const brand = useBrand()
  const c = cinema(brand.id)
  const { dark, toggle: toggleTheme } = useTheme()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const sections = navItems(brand.id)
  const unreadCount = useUnreadCount()
  const { data: auth } = useAuthMe()

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    window.location.reload()
  }

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <div
      className="flex h-full w-[230px] flex-col border-r"
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${c.accent} 9%, transparent) 0%, color-mix(in srgb, ${c.accent2} 4%, transparent) 42%, color-mix(in srgb, ${c.blobs[2]} 3%, transparent) 100%), var(--theme-sidebar-bg)`,
        borderColor: `color-mix(in srgb, ${c.accent} 14%, var(--theme-sidebar-border))`,
        backdropFilter: 'blur(36px)',
        WebkitBackdropFilter: 'blur(36px)',
        boxShadow: `1px 0 0 color-mix(in srgb, ${c.accent} 14%, transparent), 10px 0 40px -16px color-mix(in srgb, ${c.glow} 28%, transparent)`,
        '--cine-glow': c.glow,
        '--cine-gradient': c.gradient,
      } as React.CSSProperties}
    >
      {/* Brand header */}
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-3">
          {/* Logo mark — gradient circle */}
          <div
            data-motion={c.motion}
            className="cine-brandmark relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-tight text-white shadow-sm"
            style={{
              background: c.gradient,
              boxShadow: `0 2px 12px color-mix(in srgb, ${c.glow} 42%, transparent)`,
              '--cine-glow': c.glow,
            } as React.CSSProperties}
          >
            {brand.shortName}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--theme-text)]">
              {brand.name}
            </div>
            <SystemStatusLine />
          </div>
          {onOpenLauncher && (
            <button
              onClick={onOpenLauncher}
              title="Open launcher (⌘/)"
              aria-label="Open app launcher"
              className="cine-glow-hover flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--theme-muted)] hover:bg-[var(--theme-accent-soft)] hover:text-[var(--theme-accent)]"
            >
              <HugeiconsIcon icon={GridIcon} size={15} />
            </button>
          )}
          <NotificationsBell />
        </div>
      </div>

      <GlobalSearch />
      <HermesOrb onNavigate={onNavigate} />
      <nav className="flex-1 overflow-y-auto px-2.5 pb-2">
        {sections.map((sec) => (
          <div key={sec.section || '_top'} className="mb-3">
            {sec.section && (
              <div className="mb-1.5 flex items-center gap-2 px-2.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)] opacity-80">
                  {sec.section}
                </span>
                <span
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${c.accent} 30%, var(--theme-border)), transparent)` }}
                />
              </div>
            )}
            {sec.items.map((item) => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  data-active={active}
                  className={cn(
                    'cine-nav-item group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-[450]',
                    active
                      ? 'text-[var(--theme-accent)]'
                      : 'text-[var(--theme-muted)] hover:text-[var(--theme-accent)]',
                  )}
                  style={
                    active
                      ? {
                          background: `linear-gradient(90deg, color-mix(in srgb, ${c.accent} 16%, transparent), color-mix(in srgb, ${c.accent2} 7%, transparent))`,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.accent} 22%, transparent), 0 2px 16px -4px color-mix(in srgb, ${c.glow} 34%, transparent)`,
                          '--cine-glow': c.glow,
                          '--cine-gradient': c.gradient,
                        } as React.CSSProperties
                      : ({ '--cine-glow': c.glow, '--cine-gradient': c.gradient } as React.CSSProperties)
                  }
                >
                  <span
                    className={cn(
                      'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md transition-all duration-150',
                      !active && 'text-[var(--theme-muted)] group-hover:text-[var(--theme-accent)]',
                    )}
                    style={
                      active
                        ? {
                            background: c.gradient,
                            color: 'white',
                            boxShadow: `0 2px 10px color-mix(in srgb, ${c.glow} 42%, transparent)`,
                          }
                        : { background: 'var(--theme-hover)' }
                    }
                  >
                    <HugeiconsIcon icon={item.icon} size={14} strokeWidth={active ? 2 : 1.7} />
                  </span>
                  {item.label}
                  {item.to === '/team-chat' && <TeamChatUnreadDot />}
                  {item.to === '/conversations' && unreadCount > 0 && (
                    <span
                      className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                      style={{ background: 'var(--theme-accent)' }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
        {/* All modules launcher */}
        {onOpenLauncher && (
          <button
            onClick={onOpenLauncher}
            className="cine-glow-hover mx-0.5 flex w-[calc(100%-4px)] items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12px] font-[450] text-[var(--theme-muted)] hover:text-[var(--theme-accent)]"
            style={{ '--cine-glow': c.glow } as React.CSSProperties}
          >
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--theme-hover)' }}>
              <HugeiconsIcon icon={GridIcon} size={14} />
            </span>
            All modules
          </button>
        )}
      </nav>

      {/* Footer — compact glass card: ⌘K hint, theme toggle, settings, identity */}
      <div className="px-2.5 pb-3">
        <div className="glass-card space-y-1 rounded-xl p-1.5">
          <button
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
              )
            }}
            title="Open command palette"
            className="cine-glow-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--theme-accent-soft)]"
            style={{ '--cine-glow': c.glow } as React.CSSProperties}
          >
            <kbd
              className="rounded border px-1 py-px font-mono text-[9px] font-semibold"
              style={{ borderColor: `color-mix(in srgb, ${c.accent} 30%, var(--theme-border))`, color: 'var(--theme-accent)' }}
            >
              ⌘K
            </kbd>
            <span className="text-[11px] text-[var(--theme-muted)]">Search anything</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--theme-accent-soft)]"
            >
              <HugeiconsIcon
                icon={dark ? Sun03Icon : Moon02Icon}
                size={13}
                className="text-[var(--theme-accent)]"
              />
              <span className="text-[11px] text-[var(--theme-muted)]">
                {dark ? 'Light mode' : 'Dark mode'}
              </span>
            </button>
            <Link
              to="/settings"
              onClick={onNavigate}
              title="Settings"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg transition-colors hover:bg-[var(--theme-accent-soft)]"
            >
              <HugeiconsIcon icon={Settings02Icon} size={13} className="text-[var(--theme-muted)]" />
            </Link>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: 'var(--theme-accent)',
                boxShadow: '0 0 6px color-mix(in srgb, var(--theme-accent) 60%, transparent)',
              }}
            />
            <span className="text-[10px] text-[var(--theme-muted)]">Powered by Hermes</span>
          </div>
          {auth?.auth_enabled && auth.authenticated && (
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--theme-accent-soft)]"
            >
              <HugeiconsIcon icon={Logout01Icon} size={13} className="text-[var(--theme-muted)]" />
              <span className="truncate text-[11px] text-[var(--theme-muted)]">
                Sign out{auth.email ? ` (${auth.email})` : ''}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PWA install prompt ────────────────────────────────────────────────────────
function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1')

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as Event & { prompt?: () => Promise<void> }) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const install = async () => {
    await (prompt as { prompt: () => Promise<void> }).prompt?.()
    setPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-16 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl md:left-auto md:right-6 md:max-w-sm md:bottom-6"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
        style={{ background: 'linear-gradient(135deg, var(--theme-accent), #000)' }}
      >
        <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.89-8.9L11 9.17V15a1 1 0 0 1-2 0V9.17l-1.89 1.9a1 1 0 0 1-1.42-1.41l3.59-3.59a1 1 0 0 1 1.42 0l3.59 3.59a1 1 0 0 1-1.42 1.41z"/></svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[var(--theme-text)]">Install AI OS</p>
        <p className="text-[10px] text-[var(--theme-muted)]">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={install}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: 'var(--theme-accent)' }}
        >
          Install
        </button>
        <button onClick={dismiss} className="rounded-lg p-1 hover:bg-[var(--theme-hover)]">
          <HugeiconsIcon icon={Menu01Icon} size={12} className="text-[var(--theme-muted)]" />
        </button>
      </div>
    </div>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
function MobileBottomNav({ onOpenLauncher }: { onOpenLauncher: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const unread = useUnreadCount()
  const brand = useBrand()
  const c = cinema(brand.id)

  const leftTabs = [
    { to: '/', label: 'Home', icon: DashboardSquare01Icon },
    { to: '/conversations', label: 'Inbox', icon: Chat01Icon },
  ]
  const rightTabs = [
    { to: '/contacts', label: brand.id === 'hfm' ? 'Patients' : 'Contacts', icon: UserGroupIcon },
    { to: '', label: 'More', icon: GridIcon, action: onOpenLauncher },
  ]

  const isActive = (to: string) => to === '/' ? pathname === '/' : (to && pathname.startsWith(to))

  const renderTab = (tab: typeof leftTabs[0] & { action?: () => void }) => {
    const active = isActive(tab.to)
    const inner = (
      <>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150"
          style={active ? {
            background: c.gradient,
            color: 'white',
            boxShadow: `0 2px 12px color-mix(in srgb, ${c.glow} 45%, transparent)`,
          } : { color: 'var(--theme-muted)' }}
        >
          <HugeiconsIcon icon={tab.icon} size={16} strokeWidth={active ? 2 : 1.7} />
        </span>
        <span
          className="text-[9px] font-medium"
          style={{ color: active ? 'var(--theme-accent)' : 'var(--theme-muted)' }}
        >
          {tab.label}
        </span>
        {tab.to === '/conversations' && unread > 0 && (
          <span
            className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
            style={{ background: 'var(--theme-accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </>
    )

    if (tab.action) {
      return (
        <button
          key={tab.label}
          onClick={tab.action}
          className="relative flex flex-col items-center gap-0.5 px-3 py-1"
        >
          {inner}
        </button>
      )
    }

    return (
      <Link
        key={tab.to}
        to={tab.to}
        className="relative flex flex-col items-center gap-0.5 px-3 py-1"
      >
        {inner}
      </Link>
    )
  }

  const hermesActive = pathname.startsWith('/chat')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t md:hidden"
      style={{
        background: `linear-gradient(0deg, color-mix(in srgb, ${c.accent} 7%, transparent), transparent 70%), var(--theme-sidebar-bg)`,
        borderColor: `color-mix(in srgb, ${c.accent} 14%, var(--theme-sidebar-border))`,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: `0 -1px 0 color-mix(in srgb, ${c.accent} 14%, transparent), 0 -8px 28px -16px color-mix(in srgb, ${c.glow} 30%, transparent)`,
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '6px',
      }}
    >
      {leftTabs.map(renderTab)}

      {/* Center Hermes FAB */}
      <Link
        to="/chat"
        className="relative -mt-6 flex flex-col items-center gap-0.5"
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg"
          style={{
            background: hermesActive
              ? c.gradient
              : `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${c.accent} 55%, white), ${c.accent} 48%, ${c.accent2})`,
            boxShadow: `0 4px 20px color-mix(in srgb, ${c.glow} 55%, transparent), 0 0 0 3px var(--theme-sidebar-bg)`,
          }}
        >
          <HugeiconsIcon icon={SparklesIcon} size={20} />
        </span>
        <span
          className="text-[9px] font-semibold"
          style={{ color: hermesActive ? 'var(--theme-accent)' : 'var(--theme-muted)' }}
        >
          Hermes
        </span>
      </Link>

      {rightTabs.map(renderTab)}
    </nav>
  )
}

/** Public pages render without the app shell and without the login gate. */
function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/book') ||
    pathname.startsWith('/pay') ||
    pathname.startsWith('/proposal') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/survey') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/testimonial') ||
    pathname.startsWith('/contract/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/learn') ||
    pathname.startsWith('/wellness')
  )
}

function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { open: cmdOpen, close: cmdClose } = useCommandPalette()
  const { open: launcherOpen, openLauncher, close: closeLauncher } = useAppLauncher()
  const authQuery = useAuthMe()
  const brand = useBrand()
  const outletRef = useRef<HTMLDivElement>(null)

  // Replay the route-content entrance animation on navigation (no remount —
  // poll-driven re-renders never touch this). Restart via reflow trick.
  useEffect(() => {
    const el = outletRef.current
    if (!el) return
    el.classList.remove('cine-route-enter')
    void el.offsetWidth // force reflow so the animation restarts
    el.classList.add('cine-route-enter')
  }, [pathname])

  // Global Shift+? listener for shortcuts modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        setShowShortcuts(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Public routes render without the app shell (no sidebar, no nav) — and
  // regardless of auth state.
  if (isPublicRoute(pathname)) {
    return <Outlet />
  }

  // Auth gate — while the session check is in flight, show a minimal spinner
  // (avoids flashing the login screen for authenticated users).
  if (authQuery.isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--theme-bg-grad)', backgroundAttachment: 'fixed' }}
      >
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--theme-border)]"
          style={{ borderTopColor: 'var(--theme-accent)' }}
        />
      </div>
    )
  }

  if (authQuery.data?.auth_enabled && !authQuery.data.authenticated) {
    return <LoginScreen />
  }

  // Home gets the full cinematic aurora; every other screen gets the dimmed
  // ambient so the brand-tinted depth reads quietly behind functional content.
  const ambientIntensity = pathname === '/' ? 'hero' : 'ambient'

  return (
    <>
    <AmbientBackground intensity={ambientIntensity} />
    <CommandPalette open={cmdOpen} onClose={cmdClose} />
    <AppLauncher open={launcherOpen} onClose={closeLauncher} />
    {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
    {/* Shell container is now TRANSPARENT so the fixed AmbientBackground (-z-10)
        shows through behind the sidebar + every routed screen. The per-screen
        glass veil (.cine-screen) keeps content legible over it. */}
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <Sidebar onOpenLauncher={openLauncher} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              onNavigate={() => setMobileOpen(false)}
              onOpenLauncher={() => { setMobileOpen(false); openLauncher() }}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div
          className="flex items-center gap-2 border-b px-3 md:hidden"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${cinema(brand.id).accent} 7%, transparent), transparent), var(--theme-sidebar-bg)`,
            borderColor: `color-mix(in srgb, ${cinema(brand.id).accent} 14%, var(--theme-sidebar-border))`,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            paddingTop: 'max(env(safe-area-inset-top), 8px)',
            paddingBottom: '8px',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Menu01Icon} size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[8px] font-bold text-white"
              style={{ background: cinema(brand.id).gradient }}
            >
              {brand.shortName}
            </div>
            <span className="truncate text-[13px] font-semibold text-[var(--theme-text)]">{brand.name}</span>
          </div>
          <NotificationsBell />
        </div>
        {/* Bottom padding for mobile nav bar */}
        <main className="min-h-0 flex-1 overflow-hidden pb-16 md:pb-0">
          {/* Shared glass veil for ALL routed screens (except the cinematic
              home, which wants the full aurora). Lets the ambient read through
              while keeping content AA-legible — applied once here, not per
              screen. The home route opts out via :not. */}
          <div
            ref={outletRef}
            className={cn(
              'cine-route-enter h-full md:overflow-y-auto',
              pathname !== '/' && 'cine-screen',
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    <MobileBottomNav onOpenLauncher={openLauncher} />
    <PwaInstallBanner />
    <PushOptIn />
    <HermesFloat />
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
