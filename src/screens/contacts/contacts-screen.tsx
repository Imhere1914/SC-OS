import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import {
  Add01Icon,
  Building01Icon,
  Delete01Icon,
  Mail01Icon,
  Search01Icon,
  SmartPhone01Icon,
  Upload01Icon,
  UserGroupIcon,
  ViewIcon,
  ListViewIcon,
} from '@hugeicons/core-free-icons'
import { CsvImportDialog } from '@/components/CsvImportDialog'
import {
  CONTACT_STAGES,
  STAGE_LABELS,
  createContact,
  deleteContact,
  fetchContacts,
  updateContact,
} from '@/lib/contacts-api'
import type { Contact, ContactStage, CreateContactInput } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'
import { ScreenShell } from '@/components/screen-shell'

const QUERY_KEY = ['contacts'] as const
const STAGE_COLORS: Record<ContactStage, string> = {
  lead: 'var(--theme-muted)',
  contacted: 'var(--theme-accent)',
  qualified: 'var(--theme-warning)',
  customer: 'var(--theme-success)',
  lost: 'var(--theme-danger)',
}
const STAGE_BG: Record<ContactStage, string> = {
  lead: '#94a3b820',
  contacted: '#3b82f620',
  qualified: '#f59e0b20',
  customer: '#22c55e20',
  lost: '#ef444420',
}

type FormState = {
  name: string; email: string; phone: string; company: string; stage: ContactStage; notes: string; tags: string
}
const EMPTY_FORM: FormState = { name: '', email: '', phone: '', company: '', stage: 'lead', notes: '', tags: '' }

function ContactDialog({ open, initial, onClose, onSubmit, isSubmitting, title }: {
  open: boolean; initial: FormState; onClose: () => void; onSubmit: (f: FormState) => void; isSubmitting: boolean; title: string
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => { if (open) setForm(initial) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">{title}</h2>
        <div className="space-y-3">
          {([['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['company', 'Company', 'text'], ['tags', 'Tags (comma-separated)', 'text']] as Array<[keyof FormState, string, string]>).map(([key, label, type]) => (
            <div key={key}>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">{label}</label>
              <input type={type} value={form[key]} onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]" />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Stage</label>
            <select value={form.stage} onChange={(e) => set('stage', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]">
              {CONTACT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={!form.name.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--theme-accent)' }}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban column card ────────────────────────────────────────────────────────
function KanbanCard({ c, onDelete }: { c: Contact; onDelete: (id: string) => void }) {
  return (
    <Link
      to="/contacts/$id"
      params={{ id: c.id }}
      className="block rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 transition-colors hover:bg-[var(--theme-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--theme-text)] leading-snug">{c.name}</p>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete ${c.name}?`)) onDelete(c.id) }}
          className="shrink-0 rounded-md p-0.5 hover:bg-[var(--theme-hover)] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <HugeiconsIcon icon={Delete01Icon} size={11} style={{ color: 'var(--theme-danger)' }} />
        </button>
      </div>
      {c.company && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={Building01Icon} size={9} />{c.company}</p>}
      {c.email && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={Mail01Icon} size={9} />{c.email}</p>}
      {c.phone && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]"><HugeiconsIcon icon={SmartPhone01Icon} size={9} />{c.phone}</p>}
      {c.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-0.5">
          {c.tags.slice(0, 3).map(t => <span key={t} className="rounded border border-[var(--theme-border)] px-1 py-px text-[8px] text-[var(--theme-muted)]">{t}</span>)}
        </div>
      )}
    </Link>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────
function KanbanView({ contacts, onDelete }: { contacts: Contact[]; onDelete: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 pb-3" style={{ minWidth: 900 }}>
        {CONTACT_STAGES.map(stage => {
          const cols = contacts.filter(c => c.stage === stage)
          return (
            <div key={stage} className="flex w-52 shrink-0 flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]" style={{ background: STAGE_BG[stage] }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--theme-border)]">
                <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                <span className="text-[11px] font-semibold text-[var(--theme-text)]">{STAGE_LABELS[stage]}</span>
                <span className="ml-auto rounded-full bg-[var(--theme-card)] px-1.5 py-px text-[9px] font-bold text-[var(--theme-muted)]">{cols.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2.5 group">
                {cols.length === 0 ? (
                  <p className="py-4 text-center text-[10px] text-[var(--theme-muted)] opacity-50">Empty</p>
                ) : (
                  cols.map(c => <KanbanCard key={c.id} c={c} onDelete={onDelete} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function ContactsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const term = brand.id === 'hfm' ? 'Patients' : 'Contacts'
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<ContactStage | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const contactsQuery = useQuery({ queryKey: QUERY_KEY, queryFn: () => fetchContacts() })
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (i: CreateContactInput) => createContact(i),
    onSuccess: () => { invalidate(); toast('Contact created'); setShowCreate(false) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed', { type: 'error' }),
  })
  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: CreateContactInput }) => updateContact(p.id, p.updates),
    onSuccess: () => { invalidate(); toast('Contact updated'); setEditing(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed', { type: 'error' }),
  })
  const deleteMutation = useMutation({ mutationFn: (id: string) => deleteContact(id), onSuccess: () => { invalidate(); toast('Deleted') } })

  const filtered = useMemo(() => {
    let list = contactsQuery.data ?? []
    if (stageFilter !== 'all') list = list.filter((c) => c.stage === stageFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q))
    }
    return list
  }, [contactsQuery.data, stageFilter, search])

  const toForm = (c: Contact): FormState => ({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', company: c.company ?? '', stage: c.stage, notes: c.notes, tags: c.tags.join(', ') })
  const fromForm = (f: FormState): CreateContactInput => ({
    name: f.name.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, company: f.company.trim() || null,
    stage: f.stage, notes: f.notes, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  })

  return (
    <ScreenShell
      icon={UserGroupIcon}
      title={term}
      count={contactsQuery.data?.length}
      onRefresh={invalidate}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
            title="Import from CSV"
          >
            <HugeiconsIcon icon={Upload01Icon} size={13} /> Import
          </button>
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn('rounded-md px-2 py-1 transition-colors', viewMode === 'list' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
              title="List view"
            >
              <HugeiconsIcon icon={ListViewIcon} size={13} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn('rounded-md px-2 py-1 transition-colors', viewMode === 'kanban' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
              title="Kanban view"
            >
              <HugeiconsIcon icon={ViewIcon} size={13} />
            </button>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ background: 'var(--theme-accent)' }}>
            <HugeiconsIcon icon={Add01Icon} size={14} /> New {term === 'Patients' ? 'Patient' : 'Contact'}
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4">
        <div className="relative mb-3">
          <HugeiconsIcon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
          <input type="text" placeholder={`Search ${term.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-8 pr-3 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]" />
        </div>
        {viewMode === 'list' && (
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...CONTACT_STAGES] as const).map((s) => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  stageFilter === s ? 'border-transparent text-white' : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
                style={stageFilter === s ? { background: 'var(--theme-accent)' } : undefined}>
                {s === 'all' ? 'All' : STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Kanban view ── */}
      {viewMode === 'kanban' && !contactsQuery.isLoading && (
        <div className="mt-4">
          <KanbanView
            contacts={filtered}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div className="mt-4 space-y-2">
          {contactsQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--theme-muted)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={UserGroupIcon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No {term.toLowerCase()} yet</p>
              <p className="mt-1 text-xs">Add one to get started.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((c) => (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Link
                    to="/contacts/$id"
                    params={{ id: c.id }}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-colors hover:bg-[var(--theme-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLORS[c.stage] }} />
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">{c.name}</h3>
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide" style={{ background: 'var(--theme-bg)', color: STAGE_COLORS[c.stage] }}>{STAGE_LABELS[c.stage]}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--theme-muted)]">
                        {c.company && <span className="flex items-center gap-1"><HugeiconsIcon icon={Building01Icon} size={11} />{c.company}</span>}
                        {c.email && <span className="flex items-center gap-1"><HugeiconsIcon icon={Mail01Icon} size={11} />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><HugeiconsIcon icon={SmartPhone01Icon} size={11} />{c.phone}</span>}
                      </div>
                      {c.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.tags.map((t) => <span key={t} className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[9px] text-[var(--theme-muted)]">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id) }}
                      className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]" title="Delete">
                      <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                    </button>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <ContactDialog open={showCreate} initial={EMPTY_FORM} title={`New ${term === 'Patients' ? 'Patient' : 'Contact'}`} isSubmitting={createMutation.isPending}
        onClose={() => setShowCreate(false)} onSubmit={(f) => createMutation.mutate(fromForm(f))} />
      {/* Edit dialog still available but we now navigate for viewing */}
      <ContactDialog open={editing !== null} initial={editing ? toForm(editing) : EMPTY_FORM} title="Edit Contact" isSubmitting={updateMutation.isPending}
        onClose={() => setEditing(null)} onSubmit={(f) => { if (editing) updateMutation.mutate({ id: editing.id, updates: fromForm(f) }) }} />
    </ScreenShell>
  )
}
