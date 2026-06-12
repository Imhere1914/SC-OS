import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiMagicIcon,
  ArrowLeft01Icon,
  Building01Icon,
  Calendar01Icon,
  Cancel01Icon,
  Delete01Icon,
  FlowSquareIcon,
  Mail01Icon,
  Money01Icon,
  PencilEdit02Icon,
  PlayIcon,
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
import { fetchAutomations, type AutomationRecord } from '@/lib/automations-api'
import type { Contact, ContactStage, UpdateContactInput } from '@/lib/contacts-api'
import { computeLeadScore } from '@/lib/lead-score'
import { STATUS_LABELS, STATUS_COLORS, STATUS_BG, formatCurrency } from '@/lib/invoices-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

export const Route = createFileRoute('/contacts/$id')({ component: ContactDetail })

// ── Timeline event display config ──────────────────────────────────────────
const TIMELINE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  contact_created:      { emoji: '👤', color: '#6366f1', label: 'Contact created' },
  stage_changed:        { emoji: '🔄', color: '#f59e0b', label: 'Stage changed' },
  note_updated:         { emoji: '📝', color: '#64748b', label: 'Note updated' },
  appointment_created:  { emoji: '📅', color: '#22c55e', label: 'Appointment booked' },
  appointment_completed:{ emoji: '✅', color: '#10b981', label: 'Appointment completed' },
  invoice_created:      { emoji: '🧾', color: '#8b5cf6', label: 'Invoice created' },
  invoice_paid:         { emoji: '💰', color: '#10b981', label: 'Invoice paid' },
  form_submitted:       { emoji: '📋', color: '#0ea5e9', label: 'Form submitted' },
  conversation_started: { emoji: '💬', color: '#0ea5e9', label: 'Conversation' },
  tag_added:            { emoji: '🏷️', color: '#ec4899', label: 'Tag added' },
  custom:               { emoji: '•',  color: '#94a3b8', label: 'Activity' },
}

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

// ── Custom fields panel ──────────────────────────────────────────────────────
function CustomFieldsPanel({ fields, onSave }: {
  fields: Record<string, string>
  onSave: (fields: Record<string, string>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Array<{ key: string; value: string }>>([])

  const entries = Object.entries(fields)

  const startEdit = () => {
    setDraft(entries.length > 0 ? entries.map(([k, v]) => ({ key: k, value: v })) : [{ key: '', value: '' }])
    setEditing(true)
  }

  const save = () => {
    const clean: Record<string, string> = {}
    draft.forEach(({ key, value }) => { if (key.trim()) clean[key.trim()] = value })
    onSave(clean)
    setEditing(false)
  }

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Custom Fields</h2>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--theme-accent)] hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={PencilEdit02Icon} size={11} /> Edit
          </button>
        )}
      </div>
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            {draft.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.key}
                  onChange={e => setDraft(d => d.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                  placeholder="Field name"
                  className="w-32 shrink-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[11px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                />
                <input
                  value={row.value}
                  onChange={e => setDraft(d => d.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                  placeholder="Value"
                  className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[11px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                />
                <button onClick={() => setDraft(d => d.filter((_, j) => j !== i))} className="shrink-0 text-[var(--theme-muted)] hover:text-[var(--theme-danger)]">
                  <HugeiconsIcon icon={Cancel01Icon} size={12} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDraft(d => [...d, { key: '', value: '' }])} className="flex items-center gap-1 text-[10px] text-[var(--theme-accent)] hover:underline">
                <HugeiconsIcon icon={Add01Icon} size={11} /> Add field
              </button>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setEditing(false)} className="rounded-lg px-2 py-1 text-[10px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Cancel</button>
                <button onClick={save} className="rounded-lg px-2 py-1 text-[10px] font-medium text-white" style={{ background: 'var(--theme-accent)' }}>Save</button>
              </div>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <button onClick={startEdit} className="text-xs text-[var(--theme-muted)] hover:text-[var(--theme-accent)]">+ Add custom fields</button>
        ) : (
          <dl className="space-y-1.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <dt className="w-32 shrink-0 truncate text-[10px] font-medium text-[var(--theme-muted)]">{k}</dt>
                <dd className="min-w-0 truncate text-xs text-[var(--theme-text)]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
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

// ── AI Insights panel ─────────────────────────────────────────────────────
function AiInsightsPanel({ contact, activity }: {
  contact: Contact
  activity: { type: string; description: string; created_at: string }[]
}) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    setInsight(null)
    try {
      const prompt = [
        `You are a CRM assistant. Analyze this contact and provide 3-5 concise, actionable insights.`,
        ``,
        `Contact: ${contact.name}`,
        contact.company ? `Company: ${contact.company}` : '',
        contact.email ? `Email: ${contact.email}` : '',
        contact.phone ? `Phone: ${contact.phone}` : '',
        `Stage: ${contact.stage}`,
        contact.tags.length ? `Tags: ${contact.tags.join(', ')}` : '',
        contact.notes ? `Notes: ${contact.notes}` : '',
        ``,
        `Recent activity (last 5 events):`,
        ...activity.slice(0, 5).map(e => `- ${e.description}`),
        ``,
        `Provide: 1) Next best action, 2) Talking points, 3) Risk/opportunity flags. Be specific and brief.`,
      ].filter(Boolean).join('\n')

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { reply?: string }
      setInsight(data.reply ?? 'No insights available.')
    } catch {
      setInsight('Failed to load insights — check AI configuration.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiMagicIcon} size={14} className="text-[var(--theme-accent)]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-muted)]">AI Insights</h2>
        </div>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--theme-accent)' }}
        >
          {loading ? (
            <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Thinking…</>
          ) : (
            <><HugeiconsIcon icon={AiMagicIcon} size={12} /> {insight ? 'Refresh' : 'Generate'}</>
          )}
        </button>
      </div>
      <div className="p-4">
        {!insight && !loading && (
          <p className="text-xs text-[var(--theme-muted)]">
            Click <strong>Generate</strong> to get AI-powered outreach suggestions, talking points, and next-step recommendations for this contact.
          </p>
        )}
        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-3 animate-pulse rounded bg-[var(--theme-hover)]" style={{ width: `${75 + i * 8}%` }} />)}
          </div>
        )}
        {insight && (
          <div className="prose prose-sm max-w-none">
            {insight.split('\n').filter(Boolean).map((line, i) => {
              const isBullet = /^[-•*\d]/.test(line.trim())
              const isHeader = /^\*\*/.test(line.trim()) || /^#{1,3}\s/.test(line.trim())
              const cleaned = line.replace(/\*\*/g, '').replace(/^#{1,3}\s/, '').trim()
              if (isHeader) return <p key={i} className="mt-3 text-[11px] font-bold text-[var(--theme-text)] first:mt-0">{cleaned}</p>
              if (isBullet) return <p key={i} className="text-[11px] leading-relaxed text-[var(--theme-text)]">• {cleaned.replace(/^[-•*\d+.]\s*/, '')}</p>
              return <p key={i} className="text-[11px] leading-relaxed text-[var(--theme-muted)]">{cleaned}</p>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Run automation panel ─────────────────────────────────────────────────────
function RunAutomationPanel({ contact }: { contact: Contact }) {
  const [running, setRunning] = useState<string | null>(null)
  const [ran, setRan] = useState<Set<string>>(new Set())

  const autoQuery = useQuery({
    queryKey: ['automations-for-contact'],
    queryFn: () => fetchAutomations(),
    staleTime: 60_000,
  })

  const activeAutomations = (autoQuery.data ?? []).filter((a: AutomationRecord) => a.enabled)

  const runAutomation = async (auto: AutomationRecord) => {
    setRunning(auto.id)
    try {
      await fetch(`/api/automations/${auto.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          contact_name: contact.name,
          contact_email: contact.email,
          contact_stage: contact.stage,
          contact_tags: contact.tags,
        }),
      })
      setRan(prev => new Set([...prev, auto.id]))
      toast(`"${auto.name}" triggered for ${contact.name}`)
    } catch {
      toast('Failed to run automation', { type: 'error' })
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] px-4 py-3">
        <HugeiconsIcon icon={FlowSquareIcon} size={14} className="text-[var(--theme-accent)]" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Run Automation</h2>
      </div>
      <div className="p-3">
        {autoQuery.isLoading ? (
          <p className="text-xs text-[var(--theme-muted)]">Loading…</p>
        ) : activeAutomations.length === 0 ? (
          <p className="text-xs text-[var(--theme-muted)]">
            No active automations. <a href="/automations" className="text-[var(--theme-accent)] hover:underline">Create one →</a>
          </p>
        ) : (
          <div className="space-y-1.5">
            {activeAutomations.map((auto: AutomationRecord) => (
              <button
                key={auto.id}
                onClick={() => void runAutomation(auto)}
                disabled={running === auto.id || ran.has(auto.id)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--theme-border)] px-3 py-2 text-left transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-60"
              >
                <span className="text-[14px]">{ran.has(auto.id) ? '✅' : running === auto.id ? '⏳' : '▶'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[var(--theme-text)]">{auto.name}</p>
                  {auto.description && <p className="truncate text-[9px] text-[var(--theme-muted)]">{auto.description}</p>}
                </div>
                <HugeiconsIcon icon={PlayIcon} size={11} className="shrink-0 text-[var(--theme-accent)]" />
              </button>
            ))}
          </div>
        )}
      </div>
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
                  style={{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #000))` }}
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

              <div className="mt-3 flex items-center gap-2">
                <StageChip
                  stage={contact.stage}
                  onUpdate={(s) => updateMutation.mutate({ stage: s })}
                />
                {(() => {
                  const ls = computeLeadScore(contact)
                  return (
                    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: `${ls.color}20` }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ls.color }} />
                      <span className="text-[11px] font-bold" style={{ color: ls.color }}>
                        Score {ls.score}
                      </span>
                      <span className="text-[10px] capitalize text-[var(--theme-muted)]">· {ls.tier}</span>
                    </div>
                  )
                })()}
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

            {/* ── Custom fields ── */}
            <CustomFieldsPanel
              fields={contact.custom_fields ?? {}}
              onSave={(fields) => updateMutation.mutate({ custom_fields: fields })}
            />
          </div>

          {/* ── Right: Linked records ─────────────────────────── */}
          <div className="space-y-4">
            {/* AI Insights */}
            <AiInsightsPanel contact={contact} activity={activity} />
            <RunAutomationPanel contact={contact} />
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
            <Section title={`Activity${activity.length > 0 ? ` (${activity.length})` : ''}`} icon={Time01Icon}>
              {activity.length === 0 ? (
                <p className="py-2 text-xs text-[var(--theme-muted)]">
                  No activity yet — actions like stage changes, notes, appointments, and conversations appear here automatically.
                </p>
              ) : (
                <div>
                  {activity.slice(0, 25).map((ev, i) => {
                    const cfg = TIMELINE_CONFIG[ev.type] ?? { emoji: '•', color: '#94a3b8', label: 'Event' }
                    const isLast = i === Math.min(activity.length, 25) - 1
                    return (
                      <div key={ev.id} className="flex gap-3">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center pt-0.5">
                          <span
                            className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]"
                            style={{ background: `${cfg.color}18` }}
                          >
                            {cfg.emoji}
                          </span>
                          {!isLast && <span className="my-0.5 flex-1 w-px bg-[var(--theme-border)]" />}
                        </div>
                        {/* Content */}
                        <div className={cn('min-w-0 pb-3', isLast && 'pb-0')}>
                          <p className="text-[11px] font-medium" style={{ color: cfg.color }}>
                            {cfg.label}
                          </p>
                          <p className="text-[11px] text-[var(--theme-text)]">{ev.description}</p>
                          <p className="mt-0.5 text-[9px] text-[var(--theme-muted)]">
                            {new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

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

