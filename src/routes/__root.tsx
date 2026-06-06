import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  BarChartIcon,
  Briefcase01Icon,
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
  PlugSocketIcon,
  Search01Icon,
  Share04Icon,
  StarIcon,
  Target02Icon,
  TaskEdit01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'
import { NotificationsBell } from '@/components/NotificationsBell'

type NavItem = {
  to: string
  label: string
  icon: typeof Chat01Icon
}

/** Our own nav — business modules only. No Hermes dev surfaces. */
function navItems(brandId: string): { section: string; items: NavItem[] }[] {
  const contactsLabel = brandId === 'hfm' ? 'Patients' : 'Contacts'
  const projectsLabel = brandId === 'hfm' ? 'Programs' : 'Projects'
  return [
    {
      section: 'Overview',
      items: [
        { to: '/', label: 'Dashboard', icon: DashboardSquare01Icon },
        { to: '/chat', label: 'Assistant', icon: Chat01Icon },
        { to: '/highlights', label: 'Highlights', icon: StarIcon },
        { to: '/knowledge', label: 'Knowledge Vault', icon: AiBrain01Icon },
      ],
    },
    {
      section: 'Engage',
      items: [
        { to: '/conversations', label: 'Conversations', icon: Chat01Icon },
        { to: '/contacts', label: contactsLabel, icon: UserGroupIcon },
        { to: '/appointments', label: 'Appointments', icon: Calendar01Icon },
        { to: '/scheduling', label: 'Scheduling', icon: Calendar01Icon },
        { to: '/forms', label: 'Forms', icon: TaskEdit01Icon },
      ],
    },
    {
      section: 'Grow',
      items: [
        { to: '/social', label: 'Social', icon: Share04Icon },
        { to: '/campaigns', label: 'Campaigns', icon: Mail01Icon },
        { to: '/calendar', label: 'Content Calendar', icon: Calendar01Icon },
        { to: '/pages', label: 'Pages', icon: Layout01Icon },
        { to: '/templates', label: 'Templates', icon: Copy01Icon },
        { to: '/media', label: 'Media Studio', icon: ImageAdd01Icon },
      ],
    },
    {
      section: 'Operate',
      items: [
        { to: '/projects', label: projectsLabel, icon: Briefcase01Icon },
        { to: '/payments', label: 'Payments', icon: Money01Icon },
        { to: '/automations', label: 'Automations', icon: FlowSquareIcon },
        { to: '/reports', label: 'Reports', icon: BarChartIcon },
        { to: '/strategy', label: 'Strategy', icon: Target02Icon },
        { to: '/avatars', label: 'Avatars', icon: UserCircleIcon },
        { to: '/plugins', label: 'Plugins', icon: PlugSocketIcon },
      ],
    },
  ]
}

// ── Global search widget ───────────────────────────────────────────────────────
type SearchHit = { id: string; type: string; title: string; sub: string; link: string }

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
        const data = (await res.json()) as { hits: SearchHit[] }
        setHits(data.hits ?? [])
        setOpen(true)
        setIdx(0)
      } catch { /* ignore */ }
    }, 220)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, brand.id])

  const go = (hit: SearchHit) => {
    void navigate({ to: hit.link as '/' })
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
                  <p className="truncate text-[9px] text-[var(--theme-muted)]">{hit.sub}</p>
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

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const brand = useBrand()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const sections = navItems(brand.id)

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <div
      className="flex h-full w-[230px] flex-col border-r"
      style={{
        background: 'var(--theme-sidebar-bg)',
        borderColor: 'var(--theme-sidebar-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Brand header */}
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-3">
          {/* Logo mark — gradient circle */}
          <div
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-tight text-white shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #7b3fe4))`,
              boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`,
            }}
          >
            {brand.shortName}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--theme-text)]">
              {brand.name}
            </div>
            <div className="text-[10px] font-medium leading-tight tracking-wide text-[var(--theme-muted)]">
              AI Operating System
            </div>
          </div>
          <NotificationsBell />
        </div>
      </div>

      <GlobalSearch />
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-4">
            <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
              {sec.section}
            </div>
            {sec.items.map((item) => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-[450] transition-all duration-150',
                    active
                      ? 'text-[var(--theme-accent)]'
                      : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={
                    active
                      ? { background: 'var(--theme-accent-soft)' }
                      : undefined
                  }
                >
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md transition-all duration-150"
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #7b3fe4))`,
                            color: 'white',
                            boxShadow: `0 2px 8px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
                          }
                        : { background: 'var(--theme-hover)', color: 'var(--theme-muted)' }
                    }
                  >
                    <HugeiconsIcon icon={item.icon} size={14} strokeWidth={active ? 2 : 1.7} />
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer version pill */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--theme-hover)] px-2.5 py-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--theme-accent)' }}
          />
          <span className="text-[11px] text-[var(--theme-muted)]">
            Powered by Hermes
          </span>
        </div>
      </div>
    </div>
  )
}

function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Public routes render without the app shell (no sidebar, no nav)
  if (pathname.startsWith('/book')) {
    return <Outlet />
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--theme-bg-grad)', backgroundAttachment: 'fixed' }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div
          className="flex items-center gap-2 border-b px-3 py-2 md:hidden"
          style={{
            background: 'var(--theme-sidebar-bg)',
            borderColor: 'var(--theme-sidebar-border)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Menu01Icon} size={20} />
          </button>
        </div>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export const Route = createRootRoute({ component: RootLayout })
