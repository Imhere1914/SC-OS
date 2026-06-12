/**
 * Cmd+K / Ctrl+K command palette.
 * Wire into __root.tsx with <CommandPalette /> and the useCommandPalette hook.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
  Mail01Icon,
  Money01Icon,
  Money02Icon,
  Search01Icon,
  Share04Icon,
  StarIcon,
  TaskEdit01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

type Item = {
  id: string
  label: string
  sub?: string
  icon: typeof Chat01Icon
  action: () => void
  section: string
  keywords?: string
}

const NAV_ITEMS = (brandId: string): Omit<Item, 'action'>[] => [
  { id: 'nav-/', label: 'Dashboard', icon: DashboardSquare01Icon, section: 'Navigate' },
  { id: 'nav-/chat', label: 'Assistant', icon: Chat01Icon, section: 'Navigate' },
  { id: 'nav-/contacts', label: brandId === 'hfm' ? 'Patients' : 'Contacts', icon: UserGroupIcon, section: 'Navigate' },
  { id: 'nav-/conversations', label: 'Conversations', icon: Mail01Icon, section: 'Navigate' },
  { id: 'nav-/appointments', label: 'Appointments', icon: Calendar01Icon, section: 'Navigate' },
  { id: 'nav-/scheduling', label: 'Scheduling', icon: Calendar01Icon, section: 'Navigate' },
  { id: 'nav-/forms', label: 'Forms', icon: TaskEdit01Icon, section: 'Navigate' },
  { id: 'nav-/payments', label: 'Payments', icon: Money01Icon, section: 'Navigate' },
  { id: 'nav-/social', label: 'Social', icon: Share04Icon, section: 'Navigate' },
  { id: 'nav-/campaigns', label: 'Campaigns', icon: Mail01Icon, section: 'Navigate' },
  { id: 'nav-/projects', label: 'Projects', icon: Briefcase01Icon, section: 'Navigate' },
  { id: 'nav-/automations', label: 'Automations', icon: FlowSquareIcon, section: 'Navigate' },
  { id: 'nav-/reports', label: 'Reports', icon: BarChartIcon, section: 'Navigate' },
  { id: 'nav-/templates', label: 'Templates', icon: Copy01Icon, section: 'Navigate' },
  { id: 'nav-/pages', label: 'Pages', icon: Layout01Icon, section: 'Navigate' },
  { id: 'nav-/knowledge', label: 'Knowledge Vault', icon: AiBrain01Icon, section: 'Navigate' },
  { id: 'nav-/highlights', label: 'Highlights', icon: StarIcon, section: 'Navigate' },
]

const CREATE_ITEMS = (navigate: ReturnType<typeof useNavigate>, close: () => void): Item[] => [
  { id: 'create-contact', label: 'New Contact', sub: 'Open Contacts screen', icon: UserGroupIcon, section: 'Create', action: () => { void navigate({ to: '/contacts' }); close() } },
  { id: 'create-invoice', label: 'New Invoice', sub: 'Open Payments screen', icon: Money01Icon, section: 'Create', action: () => { void navigate({ to: '/payments' }); close() } },
  { id: 'create-appointment', label: 'New Appointment', sub: 'Open Appointments screen', icon: Calendar01Icon, section: 'Create', action: () => { void navigate({ to: '/appointments' }); close() } },
  { id: 'create-campaign', label: 'New Campaign', sub: 'Open Campaigns screen', icon: Mail01Icon, section: 'Create', action: () => { void navigate({ to: '/campaigns' }); close() } },
]

type SearchHit = { id: string; type: string; title: string; subtitle?: string; sub?: string; meta?: string; url?: string; link?: string; icon?: string }

function HitIcon({ type }: { type: string }) {
  const icon = type === 'contact' ? UserGroupIcon : type === 'conversation' ? Chat01Icon : type === 'appointment' ? Calendar01Icon : type === 'deal' ? Money02Icon : Money01Icon
  return <HugeiconsIcon icon={icon} size={13} />
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const brand = useBrand()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) { setQuery(''); setActiveIdx(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  // Search hits
  const searchQuery = useQuery({
    queryKey: ['cmd-search', query, brand.id],
    queryFn: async () => {
      if (query.length < 2) return { results: [] as SearchHit[] }
      const brandParam = brand.id !== 'default' ? `&brand=${brand.id}` : ''
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${brandParam}`)
      return res.json() as Promise<{ results: SearchHit[] }>
    },
    enabled: open,
  })

  const navItems = NAV_ITEMS(brand.id)
  const createItems = CREATE_ITEMS(navigate, onClose)

  const close = () => { onClose(); setQuery('') }

  // Build visible items based on query
  const items: Item[] = query.trim()
    ? [
        // Search hits first
        ...(searchQuery.data?.results ?? []).map(h => ({
          id: `hit-${h.id}`,
          label: h.title,
          sub: h.subtitle ?? h.sub ?? '',
          icon: UserGroupIcon,
          section: 'Results',
          action: () => { void navigate({ to: (h.url ?? h.link ?? '/') as '/' }); close() },
        })),
        // Nav items matching query
        ...navItems
          .filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
          .map(n => ({
            ...n,
            action: () => { void navigate({ to: n.id.replace('nav-', '') as '/' }); close() },
          })),
        // Create items matching
        ...createItems.filter(c => c.label.toLowerCase().includes(query.toLowerCase())),
      ]
    : [
        ...createItems,
        ...navItems.map(n => ({
          ...n,
          action: () => { void navigate({ to: n.id.replace('nav-', '') as '/' }); close() },
        })),
      ]

  const clampedIdx = Math.min(activeIdx, Math.max(0, items.length - 1))

  // Auto-scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${clampedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  if (!open) return null

  // Group items by section
  const sections: Record<string, Item[]> = {}
  items.forEach((item, i) => {
    const key = item.section
    if (!sections[key]) sections[key] = []
    sections[key].push({ ...item, _i: i } as Item & { _i: number })
  })

  let globalI = 0

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm" onClick={close}>
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-[var(--theme-border)] shadow-2xl"
        style={{ background: 'var(--theme-card)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          if (e.key === 'Enter' && items[clampedIdx]) items[clampedIdx].action()
          if (e.key === 'Escape') close()
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-4 py-3">
          <HugeiconsIcon icon={Search01Icon} size={16} className="shrink-0 text-[var(--theme-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none"
          />
          <kbd className="hidden rounded border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--theme-muted)] sm:block">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1.5">
          {items.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--theme-muted)]">No results for "{query}"</p>
          )}
          {Object.entries(sections).map(([section, sItems]) => (
            <div key={section}>
              <div className="px-4 pb-0.5 pt-2 text-[9px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">{section}</div>
              {sItems.map(item => {
                const idx = globalI++
                const isActive = idx === clampedIdx
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={item.action}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      isActive ? 'bg-[var(--theme-accent-soft)]' : 'hover:bg-[var(--theme-hover)]',
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                      isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-muted)]',
                    )} style={isActive ? { background: 'var(--theme-accent-soft)' } : { background: 'var(--theme-hover)' }}>
                      {section === 'Results' ? <HitIcon type={(item as Item & { type?: string }).type ?? 'contact'} /> : <HugeiconsIcon icon={item.icon} size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-xs', isActive ? 'font-semibold text-[var(--theme-text)]' : 'text-[var(--theme-text)]')}>{item.label}</p>
                      {item.sub && <p className="truncate text-[10px] text-[var(--theme-muted)]">{item.sub}</p>}
                    </div>
                    {isActive && <kbd className="shrink-0 rounded border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--theme-muted)]">↵</kbd>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-[var(--theme-border)] px-4 py-2">
          <span className="text-[9px] text-[var(--theme-muted)]"><kbd className="rounded border border-[var(--theme-border)] px-1">↑↓</kbd> navigate</span>
          <span className="text-[9px] text-[var(--theme-muted)]"><kbd className="rounded border border-[var(--theme-border)] px-1">↵</kbd> select</span>
          <span className="text-[9px] text-[var(--theme-muted)]"><kbd className="rounded border border-[var(--theme-border)] px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

/** Returns [open, toggle] — wire keydown in root */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return { open, close: () => setOpen(false), toggle: () => setOpen(o => !o) }
}
