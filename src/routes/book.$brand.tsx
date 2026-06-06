import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { fetchAvailability } from '@/lib/scheduling-api'
import type { BookingSettings, DayRule } from '@/lib/scheduling-api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/book/$brand')({ component: BookingPage })

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSlots(day: DayRule, duration: number, bufferAfter: number): string[] {
  const slots: string[] = []
  const slotSize = duration + bufferAfter
  const [startH, startM] = day.start_time.split(':').map(Number)
  const [endH, endM] = day.end_time.split(':').map(Number)
  const endMinutes = endH * 60 + endM
  let mins = startH * 60 + startM
  while (mins + duration <= endMinutes) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    mins += slotSize
  }
  return slots
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function monthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const blanks: null[] = Array(first.getDay()).fill(null)
  const days: Date[] = []
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return [...blanks, ...days]
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

async function createBooking(data: {
  brand: string
  contact_name: string
  contact_email: string
  notes: string
  starts_at: string
  ends_at: string
  title: string
}) {
  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to book appointment')
  return res.json()
}

// ── Page component ────────────────────────────────────────────────────────────

function BookingPage() {
  const { brand } = Route.useParams()

  const settingsQuery = useQuery({
    queryKey: ['public', 'availability', brand],
    queryFn: () => fetchAvailability(brand),
    retry: 2,
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<'calendar' | 'form' | 'done'>('calendar')

  const settings = settingsQuery.data as BookingSettings | undefined

  const windowEnd = useMemo(() => {
    if (!settings) return null
    const d = new Date(today)
    d.setDate(d.getDate() + settings.booking_window_days)
    return d
  }, [settings])

  const isDayAvailable = (d: Date): boolean => {
    if (!settings || !windowEnd) return false
    if (d < today || d > windowEnd) return false
    const rule = settings.days.find(r => r.day === d.getDay())
    return !!rule?.enabled
  }

  const slotsForDay = useMemo(() => {
    if (!selectedDate || !settings) return []
    const rule = settings.days.find(r => r.day === selectedDate.getDay())
    if (!rule?.enabled) return []
    return generateSlots(rule, settings.duration_minutes, settings.buffer_after_minutes)
  }, [selectedDate, settings])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const days = monthDays(viewYear, viewMonth)

  const bookingMutation = useMutation({
    mutationFn: () => {
      if (!selectedDate || !selectedSlot || !settings) throw new Error('Incomplete')
      const [h, m] = selectedSlot.split(':').map(Number)
      const start = new Date(selectedDate)
      start.setHours(h, m, 0, 0)
      const end = new Date(start.getTime() + settings.duration_minutes * 60_000)
      return createBooking({
        brand,
        contact_name: name.trim(),
        contact_email: email.trim(),
        notes: notes.trim(),
        title: `Booking — ${name.trim()}`,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      })
    },
    onSuccess: () => setStep('done'),
  })

  // Accent colour — derive from brand
  const accent = brand === 'hfm' ? '#7c6f9b' : '#2f6df6'

  if (settingsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (settingsQuery.isError || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-400">Booking unavailable</p>
      </div>
    )
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${accent}18` }}>
          <HugeiconsIcon icon={Tick02Icon} size={26} style={{ color: accent }} />
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">You're booked!</h1>
        <p className="mb-1 text-sm text-gray-500">
          {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot ? formatTime(selectedSlot) : ''}
        </p>
        <p className="max-w-sm text-sm text-gray-600">{settings.confirmation_message}</p>
      </div>
    )
  }

  // ── Booking form ─────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start bg-gray-50 p-6">
        <div className="w-full max-w-md">
          <button
            onClick={() => setStep('calendar')}
            className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} /> Back
          </button>

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <p className="font-medium text-gray-800">
              {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-gray-500">{selectedSlot ? formatTime(selectedSlot) : ''} · {settings.duration_minutes} min</p>
          </div>

          <h1 className="mb-4 text-lg font-bold text-gray-900">Your details</h1>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Full name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: `${accent}40` }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: `${accent}40` }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything we should know beforehand?"
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: `${accent}40` }}
              />
            </div>
          </div>

          {bookingMutation.isError && (
            <p className="mt-3 text-sm text-red-500">Something went wrong. Please try again.</p>
          )}

          <button
            onClick={() => bookingMutation.mutate()}
            disabled={!name.trim() || !email.trim() || bookingMutation.isPending}
            className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}
          >
            {bookingMutation.isPending ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    )
  }

  // ── Calendar + slot picker ───────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ background: accent }}
          >
            {brand.toUpperCase().slice(0, 2)}
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Book an appointment</h1>
            <p className="text-xs text-gray-400">{settings.duration_minutes} min · {settings.timezone}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          {/* Calendar */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            {/* Month nav */}
            <div className="mb-4 flex items-center justify-between">
              <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-100">
                <HugeiconsIcon icon={ArrowLeft01Icon} size={15} className="text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-800">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-gray-100">
                <HugeiconsIcon icon={ArrowRight01Icon} size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 text-center">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                if (!d) return <div key={i} />
                const avail = isDayAvailable(d)
                const isSelected = selectedDate?.toDateString() === d.toDateString()
                const isToday = today.toDateString() === d.toDateString()
                return (
                  <button
                    key={d.toDateString()}
                    disabled={!avail}
                    onClick={() => { setSelectedDate(d); setSelectedSlot(null) }}
                    className={cn(
                      'aspect-square rounded-xl text-sm font-medium transition-all',
                      isSelected
                        ? 'text-white shadow-sm'
                        : avail
                          ? 'text-gray-800 hover:bg-gray-100'
                          : 'cursor-default text-gray-300',
                      isToday && !isSelected ? 'ring-1 ring-inset' : '',
                    )}
                    style={isSelected ? { background: accent } : undefined}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            {!selectedDate ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <HugeiconsIcon icon={Calendar01Icon} size={24} className="mb-2 text-gray-300" />
                <p className="text-xs text-gray-400">Select a date to see available times</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                {slotsForDay.length === 0 ? (
                  <p className="text-xs text-gray-400">No slots available</p>
                ) : (
                  <div className="space-y-1.5">
                    {slotsForDay.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'w-full rounded-xl py-2 text-sm font-medium transition-all',
                          selectedSlot === slot
                            ? 'text-white shadow-sm'
                            : 'border border-gray-200 text-gray-700 hover:border-transparent hover:bg-gray-100',
                        )}
                        style={selectedSlot === slot ? { background: accent } : undefined}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* CTA */}
        {selectedDate && selectedSlot && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTime(selectedSlot)}
              </p>
              <p className="text-xs text-gray-400">{settings.duration_minutes} min session</p>
            </div>
            <button
              onClick={() => setStep('form')}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: accent }}
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
