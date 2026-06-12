import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CalendarSyncIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  GoogleIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import {
  fetchCalendarSync,
  updateCalendarSync,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  testCalendarSync,
} from '@/lib/calendar-sync-api'
import type { CalendarSyncConfig } from '@/lib/calendar-sync-api'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'

const SYNC_KEY = ['platform', 'calendar-sync'] as const

function formatLastSynced(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function CalendarSyncPanel() {
  const brand = useBrand()
  const queryClient = useQueryClient()

  const syncQuery = useQuery({
    queryKey: [...SYNC_KEY, brand.id],
    queryFn: () => fetchCalendarSync(brand.id),
  })

  const config = syncQuery.data

  // Local draft for the settings form
  const [draft, setDraft] = useState<{
    calendar_id: string
    sync_direction: CalendarSyncConfig['sync_direction']
    event_prefix: string
    enabled: boolean
  } | null>(null)

  // Initialise draft once config loads (only once)
  if (config && draft === null) {
    setDraft({
      calendar_id: config.calendar_id ?? '',
      sync_direction: config.sync_direction,
      event_prefix: config.event_prefix,
      enabled: config.enabled,
    })
  }

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: SYNC_KEY })

  // Connect
  const connectMutation = useMutation({
    mutationFn: () => connectGoogleCalendar(brand.id),
    onSuccess: (data) => {
      invalidate()
      toast(data.message)
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Connection failed', { type: 'error' }),
  })

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGoogleCalendar(brand.id),
    onSuccess: () => {
      invalidate()
      toast('Google Calendar disconnected')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Disconnect failed', { type: 'error' }),
  })

  // Save settings
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft')
      return updateCalendarSync(brand.id, {
        calendar_id: draft.calendar_id.trim() || null,
        sync_direction: draft.sync_direction,
        event_prefix: draft.event_prefix,
        enabled: draft.enabled,
      })
    },
    onSuccess: () => {
      invalidate()
      toast('Calendar sync settings saved')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Save failed', { type: 'error' }),
  })

  // Test sync
  const testMutation = useMutation({
    mutationFn: () => testCalendarSync(brand.id),
    onSuccess: (data) => {
      invalidate()
      toast(data.message)
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Test sync failed', { type: 'error' }),
  })

  if (syncQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--theme-muted)]">
        Loading…
      </div>
    )
  }

  const connected = config?.google_connected ?? false

  return (
    <div className="space-y-4">
      {/* ── Connection card ── */}
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--theme-hover)' }}>
            <HugeiconsIcon icon={GoogleIcon} size={20} className="text-[var(--theme-text)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--theme-text)]">Google Calendar</h2>
              {connected ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-[var(--theme-hover)] px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-muted)]">
                  <HugeiconsIcon icon={Cancel01Icon} size={11} />
                  Not connected
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">
              {connected
                ? 'Your Google Calendar is linked. Configure sync settings below.'
                : 'Connect your Google Calendar to sync appointments automatically.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {connected ? (
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
              >
                {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={GoogleIcon} size={13} />
                {connectMutation.isPending ? 'Connecting…' : 'Connect Google Calendar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings card (only when connected) ── */}
      {connected && draft && (
        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <HugeiconsIcon icon={CalendarSyncIcon} size={16} className="text-[var(--theme-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--theme-text)]">Sync Settings</h2>
          </div>

          <div className="space-y-4">
            {/* Calendar ID */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Calendar ID
              </label>
              <input
                value={draft.calendar_id}
                onChange={(e) => setDraft((d) => d && { ...d, calendar_id: e.target.value })}
                placeholder="e.g. primary or your-email@gmail.com"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
              <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
                Use &quot;primary&quot; for your default Google Calendar.
              </p>
            </div>

            {/* Sync direction */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Sync Direction
              </label>
              <select
                value={draft.sync_direction}
                onChange={(e) =>
                  setDraft((d) => d && { ...d, sync_direction: e.target.value as CalendarSyncConfig['sync_direction'] })
                }
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-3 py-1.5 text-xs text-[var(--theme-text)]"
              >
                <option value="push">Push only — send appointments to Google</option>
                <option value="pull">Pull only — import events from Google</option>
                <option value="bidirectional">Bidirectional — sync both ways</option>
              </select>
            </div>

            {/* Event prefix */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Event Title Prefix
              </label>
              <input
                value={draft.event_prefix}
                onChange={(e) => setDraft((d) => d && { ...d, event_prefix: e.target.value })}
                placeholder={`e.g. [${brand.shortName ?? brand.name}]`}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
              <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
                Prepended to event titles pushed to Google Calendar.
              </p>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] px-4 py-3">
              <div>
                <p className="text-xs font-medium text-[var(--theme-text)]">Enable sync</p>
                <p className="text-[10px] text-[var(--theme-muted)]">
                  Turn off to pause syncing without losing settings.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                onClick={() => setDraft((d) => d && { ...d, enabled: !d.enabled })}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ background: draft.enabled ? 'var(--theme-accent)' : 'var(--theme-border)' }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{ transform: draft.enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {/* Last synced */}
            <p className="text-[10px] text-[var(--theme-muted)]">
              Last synced: {formatLastSynced(config?.last_synced_at ?? null)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || saveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
              >
                <HugeiconsIcon icon={RefreshIcon} size={13} />
                {testMutation.isPending ? 'Testing…' : 'Test Sync'}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--theme-accent)' }}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Last synced (disconnected state) ── */}
      {!connected && config?.last_synced_at && (
        <p className="px-1 text-[11px] text-[var(--theme-muted)]">
          Last synced: {formatLastSynced(config.last_synced_at)}
        </p>
      )}
    </div>
  )
}
