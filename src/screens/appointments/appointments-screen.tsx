
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Calendar01Icon,
  Delete01Icon,
  Location01Icon,
  PencilEdit02Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  createAppointment,
  deleteAppointment,
  fetchAppointments,
  updateAppointment,
} from '@/lib/appointments-api'
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
} from '@/lib/appointments-api'
import { fetchContacts } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'appointments'] as const
const CONTACTS_KEY = ['platform', 'contacts', 'for-appts'] as const

const STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function dayLabel(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

type FormState = {
  title: string
  contact_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  location: string
  notes: string
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // datetime-local needs local time without timezone
    const off = d.getTimezoneOffset()
    const local = new Date(d.getTime() - off * 60_000)
    return local.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

function ApptDialog({
  open,
  initial,
  title,
  contacts,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: FormState
  title: string
  contacts: Array<{ id: string; name: string }>
  onClose: () => void
  onSubmit: (form: FormState) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  if (!open) return null
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {title}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Contact
            </label>
            <select
              value={form.contact_id}
              onChange={(e) => set('contact_id', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Starts
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs text-[var(--theme-text)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Ends (optional)
              </label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => set('ends_at', e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs text-[var(--theme-text)]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as AppointmentStatus)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Location
            </label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Office, video link, phone…"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.title.trim() || !form.starts_at || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppointmentsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [whenFilter, setWhenFilter] = useState<'upcoming' | 'all' | 'past'>(
    'upcoming',
  )
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)

  const apptsQuery = useQuery({
    queryKey: [...QUERY_KEY, whenFilter],
    queryFn: () =>
      fetchAppointments({
        brand: brand.id !== 'hermes' ? brand.id : undefined,
        when: whenFilter === 'all' ? undefined : whenFilter,
      }),
    refetchInterval: 60_000,
  })

  const contactsQuery = useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: () => fetchContacts(),
    staleTime: 60_000,
  })
  const contactOptions = useMemo(
    () => (contactsQuery.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [contactsQuery.data],
  )

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: () => {
      invalidate()
      toast('Appointment saved')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateAppointmentInput> }) =>
      updateAppointment(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Appointment updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      invalidate()
      toast('Appointment deleted')
    },
  })

  const appts = apptsQuery.data ?? []

  // Group by day
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: Appointment[] }> = []
    let curLabel = ''
    for (const a of appts) {
      const label = dayLabel(a.starts_at)
      if (label !== curLabel) {
        groups.push({ label, items: [a] })
        curLabel = label
      } else {
        groups[groups.length - 1].items.push(a)
      }
    }
    return groups
  }, [appts])

  const emptyForm: FormState = {
    title: '',
    contact_id: '',
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: '',
    status: 'scheduled',
    location: '',
    notes: '',
  }

  const toForm = (a: Appointment): FormState => ({
    title: a.title,
    contact_id: a.contact_id ?? '',
    starts_at: toLocalInput(a.starts_at),
    ends_at: toLocalInput(a.ends_at),
    status: a.status,
    location: a.location,
    notes: a.notes,
  })

  const fromForm = (f: FormState): CreateAppointmentInput => {
    const contact = contactOptions.find((c) => c.id === f.contact_id)
    return {
      title: f.title.trim(),
      contact_id: f.contact_id || null,
      contact_name: contact?.name ?? null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : new Date().toISOString(),
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      status: f.status,
      location: f.location,
      notes: f.notes,
      brand: brand.id !== 'hermes' ? brand.id : undefined,
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Calendar01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Appointments
              </h1>
              {apptsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({apptsQuery.data.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  className="text-[var(--theme-muted)]"
                />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['upcoming', 'all', 'past'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWhenFilter(w)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                  whenFilter === w
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  whenFilter === w ? { background: 'var(--theme-accent)' } : undefined
                }
              >
                {w}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-4">
          {apptsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading…
            </div>
          ) : appts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={Calendar01Icon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No {whenFilter} appointments</p>
              <p className="mt-1 text-xs">Book one and link it to a contact.</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                  {group.label}
                </h2>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((a) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        onClick={() => setEditing(a)}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-colors hover:bg-[var(--theme-hover)]"
                      >
                        <div
                          className="mt-0.5 h-10 w-1 shrink-0 rounded-full"
                          style={{ background: STATUS_COLORS[a.status] }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                              {a.title}
                            </h3>
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                              style={{
                                background: 'var(--theme-bg)',
                                color: STATUS_COLORS[a.status],
                              }}
                            >
                              {STATUS_LABELS[a.status]}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--theme-muted)]">
                            <span>{formatWhen(a.starts_at)}</span>
                            {a.contact_name && <span>· {a.contact_name}</span>}
                            {a.location && (
                              <span className="flex items-center gap-1">
                                <HugeiconsIcon icon={Location01Icon} size={11} />
                                {a.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(a)
                            }}
                            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                            title="Edit"
                          >
                            <HugeiconsIcon
                              icon={PencilEdit02Icon}
                              size={14}
                              className="text-[var(--theme-muted)]"
                            />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Delete "${a.title}"?`))
                                deleteMutation.mutate(a.id)
                            }}
                            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                            title="Delete"
                          >
                            <HugeiconsIcon
                              icon={Delete01Icon}
                              size={14}
                              style={{ color: 'var(--theme-danger)' }}
                            />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ApptDialog
        open={showCreate}
        initial={emptyForm}
        title="New Appointment"
        contacts={contactOptions}
        onClose={() => setShowCreate(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <ApptDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : emptyForm}
        title="Edit Appointment"
        contacts={contactOptions}
        onClose={() => setEditing(null)}
        onSubmit={(f) => {
          if (editing)
            updateMutation.mutate({ id: editing.id, updates: fromForm(f) })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
