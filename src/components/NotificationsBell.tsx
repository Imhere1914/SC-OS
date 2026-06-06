import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications-api'
import type { AppNotification } from '@/lib/notifications-api'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

const NOTIF_KEY = ['notifications'] as const

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationsBell() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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

  // Close on outside click
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
        onClick={() => setOpen(o => !o)}
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
          className="absolute left-0 top-full z-[200] mt-2 w-72 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-3 py-2.5">
            <span className="text-xs font-semibold text-[var(--theme-text)]">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--theme-accent)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Tick02Icon} size={10} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
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
        </div>
      )}
    </div>
  )
}
