import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Briefcase01Icon,
  Calendar01Icon,
  Chat01Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  Layout01Icon,
  ImageAdd01Icon,
  Mail01Icon,
  Menu01Icon,
  PlugSocketIcon,
  Share04Icon,
  StarIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

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
      ],
    },
    {
      section: 'Engage',
      items: [
        { to: '/conversations', label: 'Conversations', icon: Chat01Icon },
        { to: '/contacts', label: contactsLabel, icon: UserGroupIcon },
        { to: '/appointments', label: 'Appointments', icon: Calendar01Icon },
      ],
    },
    {
      section: 'Grow',
      items: [
        { to: '/social', label: 'Social', icon: Share04Icon },
        { to: '/campaigns', label: 'Campaigns', icon: Mail01Icon },
        { to: '/pages', label: 'Pages', icon: Layout01Icon },
        { to: '/templates', label: 'Templates', icon: Copy01Icon },
        { to: '/media', label: 'Media Studio', icon: ImageAdd01Icon },
      ],
    },
    {
      section: 'Operate',
      items: [
        { to: '/projects', label: projectsLabel, icon: Briefcase01Icon },
        { to: '/avatars', label: 'Avatars', icon: UserCircleIcon },
        { to: '/plugins', label: 'Plugins', icon: PlugSocketIcon },
      ],
    },
  ]
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const brand = useBrand()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const sections = navItems(brand.id)

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <div className="flex h-full w-60 flex-col border-r border-[var(--theme-border)] bg-[var(--theme-card)]">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: brand.accentColor }}
        >
          {brand.shortName}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-[var(--theme-text)]">
            {brand.name}
          </div>
          <div className="text-[10px] text-[var(--theme-muted)]">AI Operating System</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-3">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              {sec.section}
            </div>
            {sec.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive(item.to)
                    ? 'font-medium text-white'
                    : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]',
                )}
                style={
                  isActive(item.to) ? { background: brand.accentColor } : undefined
                }
              >
                <HugeiconsIcon icon={item.icon} size={17} strokeWidth={1.8} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}

function RootLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--theme-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 md:hidden">
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
