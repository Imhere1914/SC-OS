import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar01Icon,
  Copy01Icon,
  Link01Icon,
  Message01Icon,
  Settings02Icon,
  Tick02Icon,
  TimeScheduleIcon,
} from '@hugeicons/core-free-icons'
import {
  DAY_NAMES,
  fetchAvailability,
  saveAvailability,
} from '@/lib/scheduling-api'
import type { BookingSettings, DayRule } from '@/lib/scheduling-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'availability'] as const

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120]
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30]
const MAX_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]
const WINDOW_OPTIONS = [7, 14, 21, 30, 60, 90]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
]

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──
const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-40 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const selectCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

// Generate time options in 15-min increments
function timeOptions(): string[] {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return opts
}

const TIME_OPTIONS = timeOptions()

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Section card with gradient icon chip + uppercase label
function SectionCard({ icon, label, children }: {
  icon: typeof Calendar01Icon
  label: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={13} className="text-white" />
        </span>
        <h2 className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</h2>
      </div>
      {children}
    </section>
  )
}

// Visual toggle switch driven by a real checkbox (logic unchanged)
function ToggleSwitch({ checked, onChange, label }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5" title={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-all duration-150"
        style={{
          background: checked
            ? 'var(--theme-accent)'
            : 'color-mix(in srgb, var(--theme-muted) 30%, var(--theme-card))',
          boxShadow: checked ? ACCENT_GLOW : undefined,
        }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-150"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
    </label>
  )
}

export function SchedulingScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const [dirty, setDirty] = useState(false)
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [copied, setCopied] = useState(false)

  const availQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchAvailability(brand.id !== 'hermes' ? brand.id : undefined),
  })

  useEffect(() => {
    if (availQuery.data && !dirty) {
      setSettings(availQuery.data)
    }
  }, [availQuery.data, dirty])

  const saveMutation = useMutation({
    mutationFn: (s: BookingSettings) => saveAvailability({ ...s, brand: brand.id !== 'hermes' ? brand.id : undefined }),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved)
      setSettings(saved)
      setDirty(false)
      toast('Availability saved')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const update = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => {
    setSettings((s) => s ? { ...s, [key]: value } : s)
    setDirty(true)
  }

  const updateDay = (dayIdx: number, patch: Partial<DayRule>) => {
    setSettings((s) => {
      if (!s) return s
      const days = s.days.map((d) => d.day === dayIdx ? { ...d, ...patch } : d)
      return { ...s, days }
    })
    setDirty(true)
  }

  const bookingLink = `${location.origin}/book/${brand.id}`

  const copyLink = () => {
    void navigator.clipboard.writeText(bookingLink)
    setCopied(true)
    toast('Booking link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  if (availQuery.isLoading || !settings) {
    return (
      <div className="min-h-full overflow-y-auto bg-surface text-ink">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
            <div className="space-y-2">
              <div className="h-5 w-40 animate-pulse rounded bg-[var(--theme-card)] opacity-60" />
              <div className="h-3 w-64 animate-pulse rounded bg-[var(--theme-card)] opacity-60" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={TimeScheduleIcon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Scheduling</h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                Working hours, booking rules, and your public availability link
              </p>
            </div>
          </div>
          <button
            onClick={() => settings && saveMutation.mutate(settings)}
            disabled={!dirty || saveMutation.isPending}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Booking link — glass card */}
        <section
          className="rounded-2xl border p-4"
          style={{
            borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, var(--theme-border))',
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 8%, var(--theme-card)), color-mix(in srgb, #000 5%, var(--theme-card)))',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Link01Icon} size={13} className="text-white" />
            </span>
            <h2 className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Public Booking Link
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 flex-1 truncate rounded-xl border px-3 py-2 font-mono text-xs text-[var(--theme-text)]"
              style={{
                borderColor: 'color-mix(in srgb, var(--theme-accent) 20%, var(--theme-border))',
                background: 'color-mix(in srgb, var(--theme-card) 70%, transparent)',
              }}
            >
              {bookingLink}
            </div>
            <button
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={13} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-[var(--theme-muted)]">
            Share this link so clients can book time with you directly.
          </p>
        </section>

        {/* Booking settings */}
        <SectionCard icon={Settings02Icon} label="Booking Rules">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Session duration
              </label>
              <select
                value={settings.duration_minutes}
                onChange={(e) => update('duration_minutes', Number(e.target.value))}
                className={selectCls}
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Buffer before
              </label>
              <select
                value={settings.buffer_before_minutes}
                onChange={(e) => update('buffer_before_minutes', Number(e.target.value))}
                className={selectCls}
              >
                {BUFFER_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b === 0 ? 'None' : `${b} min`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Buffer after
              </label>
              <select
                value={settings.buffer_after_minutes}
                onChange={(e) => update('buffer_after_minutes', Number(e.target.value))}
                className={selectCls}
              >
                {BUFFER_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b === 0 ? 'None' : `${b} min`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Max bookings / day
              </label>
              <select
                value={settings.max_per_day}
                onChange={(e) => update('max_per_day', Number(e.target.value))}
                className={selectCls}
              >
                {MAX_PER_DAY_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Booking window
              </label>
              <select
                value={settings.booking_window_days}
                onChange={(e) => update('booking_window_days', Number(e.target.value))}
                className={selectCls}
              >
                {WINDOW_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} days out</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                className={selectCls}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {/* Working hours */}
        <SectionCard icon={Calendar01Icon} label="Working Hours">
          <div className="overflow-hidden rounded-xl border border-[var(--theme-border)]">
            {settings.days.map((day, idx) => (
              <div
                key={day.day}
                className={cn(
                  'grid grid-cols-[auto_1fr] items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--theme-hover)] sm:grid-cols-[120px_1fr]',
                  idx > 0 && 'border-t border-[var(--theme-border)]',
                )}
                style={day.enabled ? undefined : { opacity: 0.65 }}
              >
                <div className="flex items-center gap-2.5">
                  <ToggleSwitch
                    checked={day.enabled}
                    onChange={(checked) => updateDay(day.day, { enabled: checked })}
                    label={`Toggle ${DAY_NAMES[day.day]}`}
                  />
                  <span className={cn('text-xs font-semibold', day.enabled ? 'text-[var(--theme-text)]' : 'text-[var(--theme-muted)]')}>
                    {DAY_NAMES[day.day]}
                  </span>
                </div>
                {day.enabled ? (
                  <div className="flex items-center justify-end gap-2 sm:justify-start">
                    <select
                      value={day.start_time}
                      onChange={(e) => updateDay(day.day, { start_time: e.target.value })}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">to</span>
                    <select
                      value={day.end_time}
                      onChange={(e) => updateDay(day.day, { end_time: e.target.value })}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-right text-[11px] italic text-[var(--theme-muted)] sm:text-left">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Confirmation message */}
        <SectionCard icon={Message01Icon} label="Confirmation Message">
          <textarea
            value={settings.confirmation_message}
            onChange={(e) => update('confirmation_message', e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <p className="mt-1.5 text-[10px] text-[var(--theme-muted)]">
            Shown to the client after they book an appointment.
          </p>
        </SectionCard>
      </div>
    </div>
  )
}
