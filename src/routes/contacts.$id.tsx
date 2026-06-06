import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  Building01Icon,
  Calendar01Icon,
  Delete01Icon,
  Mail01Icon,
  Money01Icon,
  PencilEdit02Icon,
  SmartPhone01Icon,
  Tick02Icon,
  Time01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'
import {
  CONTACT_STAGES,
  STAGE_LABELS,
  deleteContact,
  updateContact,
} from '@/lib/contacts-api'
import type { Contact, ContactStage, UpdateContactInput } from '@/lib/contacts-api'
import { STATUS_LABELS, STATUS_COLORS, STATUS_BG, formatCurrency } from '@/lib/invoices-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

export const Route = createFileRoute('/contacts/$id')({ component: ContactDetail })

const STAGE_COLORS: Record<ContactStage, string> = {
  lead: '#94a3b8',
  contacted: 'var(--theme-accent)',
  qualified: '#f59e0b',
  customer: '#22c55e',
  lost: '#ef4444',
}

async function fetchContactDetail(id: string) {
  const res = await fetch(`/api/contacts/${id}/detail`)
  if (!res.ok) throw new Error('Contact not found')
  return res.json() as Promise<{
    contact: Contact
    conversations: { id: string; contact_name: string | null; subject: string | null; channel: string; status: string; updated_at: string }[]
    appointments: { id: string; title: string; starts_at: string; status: string; notes: string }[]
    invoices: { id: string; invoice_number: string; total: number; status: string; due_date?: string; created_at: string }[]
    activity: { id: string; type: string; description: string; created_at: string }[]
  }>
}

function Section({ title, icon, children }: { title: string; icon: typeof Mail01Icon; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] px-4 py-3">
        <HugeiconsIcon icon={icon} size={14} className="text-[var(--theme-accent)]" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function StageChip({ stage, onUpdate }: { stage: ContactStage; onUpdate: (s: ContactStage) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: STAGE_COLORS[stage] }}
      >
        {STAGE_LABELS[stage]}
        <span className="opacity-70">▾</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-10 mt-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-1 shadow-xl"
          style={{ minWidth: 140 }}
        >
          {CONTACT_STAGES.map(s => (
            <button
              key={s}
              onClick={() => { onUpdate(s); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--theme-hover)]',
                s === stage ? 'font-semibold text-[var(--theme-text)]' : 'text-[var(--theme-muted)]',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[s] }} />
              {STAGE_LABELS[s]}
              {s === stage && <HugeiconsIcon icon={Tick02Icon} size={10} className="ml-auto text-[var(--theme-accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const brand = useBrand()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesVal, setNotesVal] = useState('')

  const detailQuery = useQuery({
    queryKey: ['contact-detail', id],
    queryFn: () => fetchContactDetail(id),
  })

  const updateMutation = useMutation({
    mutationFn: (updates: UpdateContactInput) => updateContact(id, updates),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contact-detail', id] }); toast('Saved') },
    onError: () => toast('Failed to save', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteContact(id),
    onSuccess: () => { toast('Contact deleted'); void navigate({ to: '/contacts' }) },
  })

  const { contact, conversations = [], appointments = [], invoices = [], activity = [] } = detailQuery.data ?? {}

  if (detailQuery.isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-[var(--theme-muted)]">Loading…</div>
  }
  if (!contact) {
    return <div className="flex min-h-full items-center justify-center text-sm text-red-400">Contact not found</div>
  }

  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const accentColor = brand.accentColor

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Back */}
        <Link to="/contacts" className="mb-4 flex items-center gap-1.5 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={13} /> Contacts
        </Link>

        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* ── Left: Profile card ────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
              {/* Avatar */}
              <div className="mb-4 flex items-start justify-between">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #7b3fe4))` }}
                >
                  {initials || <HugeiconsIcon icon={UserCircleIcon} size={24} />}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { if (confirm(`Delete ${contact.name}?`)) deleteMutation.mutate() }}
                    className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                  </button>
                </div>
              </div>

              <h1 className="text-lg font-bold text-[var(--theme-text)]">{contact.name}</h1>
              {contact.company && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--theme-muted)]">
                  <HugeiconsIcon icon={Building01Icon} size={12} /> {contact.company}
                </p>
              )}

              <div className="mt-3">
                <StageChip
                  stage={contact.stage}
                  onUpdate={(s) => updateMutation.mutate({ stage: s })}
                />
              </div>

              {/* Contact info */}
              <div className="mt-4 space-y-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]">
                    <HugeiconsIcon icon={Mail01Icon} size={13} className="text-[var(--theme-accent)]" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]">
                    <HugeiconsIcon icon={SmartPhone01Icon} size={13} className="text-[var(--theme-accent)]" />
                    {contact.phone}
                  </a>
                )}
              </div>

              {/* Tags */}
              {contact.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {contact.tags.map(tag => (
                    <span key={tag} className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px] text-[var(--theme-muted)]">{tag}</span>
                  ))}
                </div>
              )}

              <p className="mt-4 text-[10px] text-[var(--theme-muted)]">
                Added {new Date(contact.created_at).toLocaleDateString()} · source: {contact.source}
              </p>
            </div>

            {/* Notes */}
            <Section title="Notes" icon={PencilEdit02Icon}>
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesVal}
                    onChange={e => setNotesVal(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setEditingNotes(false)} className="rounded-lg px-2 py-1 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Cancel</button>
                    <button
                      onClick={() => { updateMutation.mutate({ notes: notesVal }); setEditingNotes(false) }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-white"
                      style={{ background: 'var(--theme-accent)' }}
                    >Save</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setNotesVal(contact.notes || ''); setEditingNotes(true) }}
                  className="min-h-[60px] cursor-text rounded-xl border border-dashed border-[var(--theme-border)] p-3 text-xs text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
                >
                  {contact.notes || 'Click to add notes…'}
                </div>
              )}
            </Section>
          </div>

          {/* ── Right: Linked records ─────────────────────────── */}
          <div className="space-y-4">
            {/* Appointments */}
            <Section title={`Appointments (${appointments.length})`} icon={Calendar01Icon}>
              {appointments.length === 0 ? (
                <p className="text-xs text-[var(--theme-muted)]">No appointments yet.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map(a => (
                    <div key={a.id} className="flex items-start justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-[var(--theme-text)]">{a.title}</p>
                        <p className="text-[10px] text-[var(--theme-muted)]">
                          {new Date(a.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize', a.status === 'completed' ? 'bg-green-500/15 text-green-600' : a.status === 'cancelled' ? 'bg-red-500/15 text-red-500' : 'bg-blue-500/15 text-blue-600')}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/appointments" className="mt-3 block text-center text-[11px] text-[var(--theme-accent)] hover:underline">+ New appointment</Link>
            </Section>

            {/* Conversations */}
            <Section title={`Conversations (${conversations.length})`} icon={Mail01Icon}>
              {conversations.length === 0 ? (
                <p className="text-xs text-[var(--theme-muted)]">No conversations yet.</p>
              ) : (
                <div className="space-y-2">
                  {conversations.slice(0, 8).map(cv => (
                    <div key={cv.id} className="flex items-start justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--theme-text)]">{cv.subject || cv.channel}</p>
                        <p className="text-[10px] capitalize text-[var(--theme-muted)]">{cv.channel} · {cv.status}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--theme-muted)]">
                        {new Date(cv.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/conversations" className="mt-3 block text-center text-[11px] text-[var(--theme-accent)] hover:underline">Go to Conversations</Link>
            </Section>

            {/* Activity timeline */}
            {activity.length > 0 && (
              <Section title="Activity" icon={Time01Icon}>
                <div className="space-y-3">
                  {activity.slice(0, 15).map((ev, i) => (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--theme-accent)' }} />
                        {i < activity.slice(0, 15).length - 1 && <span className="mt-1 flex-1 w-px bg-[var(--theme-border)]" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-xs text-[var(--theme-text)]">{ev.description}</p>
                        <p className="mt-0.5 text-[9px] text-[var(--theme-muted)]">{new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Invoices */}
            <Section title={`Invoices (${invoices.length})`} icon={Money01Icon}>
              {invoices.length === 0 ? (
                <p className="text-xs text-[var(--theme-muted)]">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <Link key={inv.id} to="/invoices/$id" params={{ id: inv.id }} className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2.5 hover:bg-[var(--theme-hover)]">
                      <div>
                        <p className="font-mono text-[11px] text-[var(--theme-muted)]">{inv.invoice_number}</p>
                        <p className="text-sm font-bold text-[var(--theme-text)]">{formatCurrency(inv.total)}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                          style={{ background: STATUS_BG[inv.status as keyof typeof STATUS_BG], color: STATUS_COLORS[inv.status as keyof typeof STATUS_COLORS] }}
                        >
                          {STATUS_LABELS[inv.status as keyof typeof STATUS_LABELS]}
                        </span>
                        {inv.due_date && (
                          <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/payments" className="mt-3 block text-center text-[11px] text-[var(--theme-accent)] hover:underline">+ New invoice</Link>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

