import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon, Settings02Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications-api'
import type { AppNotification } from '@/lib/notifications-api'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

const NOTIF_KEY = ['notifications'] as const

// ── Preferences ───────────────────────────────────────────────────────────────
type NotifPrefs = {
  new_contact: boolean
  new_conversation: boolean
  form_submission: boolean
  appointment: boolean
  automation_failure: boolean
  invoice: boolean
}
const DEFAULT_PREFS: NotifPrefs = {
  new_contact: true,
  new_conversation: true,
  form_submission: true,
  appointment: true,
  automation_failure: true,
  invoice: true,
}
const PREF_LABELS: Record<keyof NotifPrefs, string> = {
  new_contact: 'New contacts',
  new_conversation: 'New conversations',
  form_submission: 'Form submissions',
  appointment: 'Appointment updates',
  automation_failure: 'Automation failures',
  invoice: 'Invoice activity',
}

function loadPrefs(): NotifPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('notif-prefs') ?? '{}') as Partial<NotifPrefs> } }
  catch { return DEFAULT_PREFS }
}
function savePrefs(p: NotifPrefs) { localStorage.setItem('notif-prefs', JSON.stringify(p)) }

function PrefsPanel() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs)
  const toggle = (k: keyof NotifPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] }
    setPrefs(next)
    savePrefs(next)
  }
  return (
    <div className="p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
        Notify me about
      </p>
      <div className="space-y-1.5">
        {(Object.keys(DEFAULT_PREFS) as (keyof NotifPrefs)[]).map(k => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-[var(--theme-hover)]">
            <span className="text-[11px] text-[var(--theme-text)]">{PREF_LABELS[k]}</span>
            <div
              onClick={() => toggle(k)}
              className={cn(
                'relative h-4 w-7 shrink-0 rounded-full transition-colors',
                prefs[k] ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
                  prefs[k] ? 'left-3.5' : 'left-0.5',
                )}
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Bell component ────────────────────────────────────────────────────────────
export function NotificationsBell() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'feed' | 'prefs'>('feed')
  const ref = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: () => fetchNotifications({ brand: brand.id !== 'default' ? brand.id : undefined }),
    refetchInterval: 30_000,
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  })
  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(brand.id !== 'default' ? brand.id : undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIF_KEY }),
  })

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const unread = query.data?.unread_count ?? 0
  const items: AppNotification[] = query.data?.notifications ?? []

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setTab('feed') }}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
        title="Notifications"
      >
        <HugeiconsIcon icon={Notification01Icon} size={16} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ background: 'var(--theme-accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-[200] mt-2 w-72 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header with tabs */}
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTab('feed')}
                className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors', tab === 'feed' ? 'bg-[var(--theme-accent-soft)] text-[var(--theme-accent)]' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
              >
                Feed {unread > 0 && <span className="ml-1 rounded-full bg-[var(--theme-accent)] px-1 py-px text-[9px] text-white">{unread}</span>}
              </button>
              <button
                onClick={() => setTab('prefs')}
                className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors', tab === 'prefs' ? 'bg-[var(--theme-accent-soft)] text-[var(--theme-accent)]' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
              >
                <HugeiconsIcon icon={Settings02Icon} size={10} />
                Prefs
              </button>
            </div>
            {tab === 'feed' && unread > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--theme-accent)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Tick02Icon} size={10} />
                All read
              </button>
            )}
          </div>

          {/* Body */}
          {tab === 'prefs' ? (
            <PrefsPanel />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-[var(--theme-muted)]">All caught up!</p>
              ) : (
                items.slice(0, 30).map(n => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read) readMutation.mutate(n.id) }}
                    className={cn(
                      'w-full border-b border-[var(--theme-border)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--theme-hover)]',
                      !n.read && 'bg-[var(--theme-accent-soft)]',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--theme-accent)' }} />
                      )}
                      <div className={cn('min-w-0', n.read && 'ml-3.5')}>
                        <p className={cn('text-[11px] leading-snug', !n.read ? 'font-semibold text-[var(--theme-text)]' : 'text-[var(--theme-muted)]')}>
                          {n.message}
                        </p>
                        {n.context_summary && (
                          <p className="mt-0.5 truncate text-[10px] text-[var(--theme-muted)]">{n.context_summary}</p>
                        )}
                        <p className="mt-0.5 text-[9px] text-[var(--theme-muted)]">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
