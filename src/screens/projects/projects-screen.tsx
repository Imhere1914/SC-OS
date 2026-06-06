
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Briefcase01Icon,
  Clock01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '@/lib/projects-api'
import type {
  CreateProjectInput,
  Project,
  ProjectPriority,
  ProjectStatus,
} from '@/lib/projects-api'
import { fetchContacts } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'projects'] as const
const CONTACTS_KEY = ['platform', 'contacts', 'for-projects'] as const

const STATUSES: ProjectStatus[] = ['active', 'on_hold', 'completed', 'cancelled']
const PRIORITIES: ProjectPriority[] = ['high', 'medium', 'low']

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

type FormState = {
  name: string
  description: string
  contact_id: string
  status: ProjectStatus
  priority: ProjectPriority
  progress: number
  due_date: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  contact_id: '',
  status: 'active',
  priority: 'medium',
  progress: 0,
  due_date: '',
  notes: '',
}

function ProjectDialog({
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

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
              Project name
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Linked contact
            </label>
            <select
              value={form.contact_id}
              onChange={(e) => set('contact_id', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as ProjectStatus)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs text-[var(--theme-text)]"
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
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  set('priority', e.target.value as ProjectPriority)
                }
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs text-[var(--theme-text)]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Progress: {form.progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progress}
              onChange={(e) => set('progress', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Due date
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
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
            disabled={!form.name.trim() || isSubmitting}
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

export function ProjectsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const term = brand.id === 'hfm' ? 'Programs' : 'Projects'

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const projectsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchProjects({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
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
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      invalidate()
      toast('Project saved')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateProjectInput> }) =>
      updateProject(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Project updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      invalidate()
      toast('Project deleted')
    },
  })

  const filtered = useMemo(() => {
    const projects = projectsQuery.data ?? []
    if (statusFilter === 'all') return projects
    return projects.filter((p) => p.status === statusFilter)
  }, [projectsQuery.data, statusFilter])

  const toForm = (p: Project): FormState => ({
    name: p.name,
    description: p.description,
    contact_id: p.contact_id ?? '',
    status: p.status,
    priority: p.priority,
    progress: p.progress,
    due_date: p.due_date ? p.due_date.slice(0, 10) : '',
    notes: p.notes,
  })

  const fromForm = (f: FormState): CreateProjectInput => {
    const contact = contactOptions.find((c) => c.id === f.contact_id)
    return {
      name: f.name.trim(),
      description: f.description,
      contact_id: f.contact_id || null,
      contact_name: contact?.name ?? null,
      status: f.status,
      priority: f.priority,
      progress: f.progress,
      due_date: f.due_date ? new Date(f.due_date).toISOString() : null,
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
                icon={Briefcase01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                {term}
              </h1>
              {projectsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({projectsQuery.data.length})
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
                New {term === 'Programs' ? 'Program' : 'Project'}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  statusFilter === s
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  statusFilter === s
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {projectsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading {term.toLowerCase()}…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon
                icon={Briefcase01Icon}
                size={32}
                className="mb-3 opacity-40"
              />
              <p className="text-sm font-medium">No {term.toLowerCase()} yet</p>
              <p className="mt-1 text-xs">
                Create one and link it to a contact.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => setEditing(p)}
                  className="cursor-pointer rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-colors hover:bg-[var(--theme-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: PRIORITY_COLORS[p.priority] }}
                          title={`${p.priority} priority`}
                        />
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {p.name}
                        </h3>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--theme-bg)',
                            color: STATUS_COLORS[p.status],
                          }}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      {p.contact_name && (
                        <p className="text-[11px] text-[var(--theme-muted)]">
                          {p.contact_name}
                        </p>
                      )}
                      {p.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-muted)]">
                          {p.description}
                        </p>
                      )}
                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--theme-bg)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${p.progress}%`,
                              background: STATUS_COLORS[p.status],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--theme-muted)]">
                          {p.progress}%
                        </span>
                      </div>
                      {p.due_date && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]">
                          <HugeiconsIcon icon={Clock01Icon} size={10} />
                          Due {formatDate(p.due_date)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(p)
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
                          if (confirm(`Delete "${p.name}"?`))
                            deleteMutation.mutate(p.id)
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
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <ProjectDialog
        open={showCreate}
        initial={EMPTY_FORM}
        title={`New ${term === 'Programs' ? 'Program' : 'Project'}`}
        contacts={contactOptions}
        onClose={() => setShowCreate(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <ProjectDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : EMPTY_FORM}
        title={`Edit ${term === 'Programs' ? 'Program' : 'Project'}`}
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
