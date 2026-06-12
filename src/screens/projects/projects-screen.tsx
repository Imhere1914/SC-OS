
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AlertCircleIcon,
  Briefcase01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete01Icon,
  KanbanIcon,
  ListViewIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Task01Icon,
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
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  createTask,
  deleteTask,
  fetchTasksForProject,
  toggleSubtask,
  updateTask,
} from '@/lib/project-tasks-api'
import type { ProjectTask, TaskPriority, TaskStatus } from '@/lib/project-tasks-api'
import { fetchContacts } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'projects'] as const
const CONTACTS_KEY = ['platform', 'contacts', 'for-projects'] as const
const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
const STATUSES: ProjectStatus[] = ['active', 'on_hold', 'completed', 'cancelled']
const PRIORITIES: ProjectPriority[] = ['high', 'medium', 'low']
const TASK_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ─

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--theme-muted)]'

function formatDate(value: string | null): string {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString() } catch { return value }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
}

function isTaskOverdue(task: ProjectTask): boolean {
  return !!task.due_date && task.status !== 'done' && new Date(task.due_date).getTime() < Date.now()
}

// Status as colored dot + soft tinted badge — never plain text
function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// Modal header — gradient icon chip + bold title + muted subtitle
function ModalHeader({ icon, title, subtitle, onClose }: {
  icon: typeof Briefcase01Icon
  title: string
  subtitle: string
  onClose?: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        <HugeiconsIcon icon={icon} size={16} className="text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
        <p className="truncate text-[11px] text-[var(--theme-muted)]">{subtitle}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]">
          <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
        </button>
      )}
    </div>
  )
}

// ── Project form ──────────────────────────────────────────────────────────────

type FormState = {
  name: string; description: string; contact_id: string
  status: ProjectStatus; priority: ProjectPriority
  progress: number; due_date: string; notes: string
}

const EMPTY_FORM: FormState = {
  name: '', description: '', contact_id: '',
  status: 'active', priority: 'medium', progress: 0, due_date: '', notes: '',
}

function ProjectDialog({
  open, initial, title, contacts, onClose, onSubmit, isSubmitting,
}: {
  open: boolean; initial: FormState; title: string
  contacts: Array<{ id: string; name: string }>
  onClose: () => void; onSubmit: (form: FormState) => void; isSubmitting: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => { if (open) setForm(initial) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Briefcase01Icon} title={title} subtitle="Track scope, status and progress" onClose={onClose} />
        <div className="space-y-3 p-5">
          <div>
            <label className={labelCls}>Project name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Linked contact</label>
            <select value={form.contact_id} onChange={e => set('contact_id', e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className={cn(inputCls, 'resize-none py-2')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as ProjectStatus)} className={inputCls}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as ProjectPriority)} className={inputCls}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Progress: <span className="tabular-nums">{form.progress}%</span></label>
            <input type="range" min={0} max={100} step={5} value={form.progress}
              onChange={e => set('progress', Number(e.target.value))} className="w-full accent-[var(--theme-accent)]" />
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={!form.name.trim() || isSubmitting}
            className={primaryBtnCls} style={primaryBtnStyle}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task create modal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  projectId, defaultStatus, onClose, onCreated,
}: {
  projectId: string; defaultStatus: TaskStatus
  onClose: () => void; onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const task = await createTask(projectId, {
        title: title.trim(),
        description,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      // Apply column status if not the default 'todo'
      if (defaultStatus !== 'todo') {
        await updateTask(projectId, task.id, { status: defaultStatus })
      }
      onCreated()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create task', { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Add01Icon} title="New task" subtitle={`Lands in ${TASK_STATUS_LABELS[defaultStatus]}`} onClose={onClose} />
        <div className="space-y-2.5 p-5">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit() }}
            placeholder="Task title…" className={inputCls} />
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)…" rows={2}
            className={cn(inputCls, 'resize-none')} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim() || saving}
            className={primaryBtnCls} style={primaryBtnStyle}>
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task detail modal ─────────────────────────────────────────────────────────

function TaskDetailModal({
  task, projectId, onClose, onUpdated,
}: {
  task: ProjectTask; projectId: string; onClose: () => void; onUpdated: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [newSubtask, setNewSubtask] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateTask(projectId, task.id, {
        title: title.trim() || task.title,
        description,
        status,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      onUpdated()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', { type: 'error' })
      setSaving(false)
    }
  }

  const handleToggleSubtask = async (subtaskId: string) => {
    try {
      await toggleSubtask(projectId, task.id, subtaskId)
      onUpdated()
    } catch { /* ignore */ }
  }

  const handleDeleteTask = async () => {
    if (!confirm(`Delete "${task.title}"?`)) return
    setDeleting(true)
    try {
      await deleteTask(projectId, task.id)
      onUpdated()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', { type: 'error' })
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Task01Icon} title="Task detail" subtitle="Edit status, schedule and subtasks" onClose={onClose} />

        <div className="space-y-4 p-5">
          {/* Title */}
          <input value={title} onChange={e => setTitle(e.target.value)}
            className={cn(inputCls, 'py-2 text-sm font-medium')} />

          {/* Status + Priority row */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</p>
            <div className="flex flex-wrap gap-2">
              {TASK_STATUSES.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all duration-150',
                    status === s ? 'border-transparent text-white shadow-sm' : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
                  style={status === s ? { background: TASK_STATUS_COLORS[s] } : undefined}>
                  {TASK_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Add a description…" className={cn(inputCls, 'resize-none py-2')} />
          </div>

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Subtasks <span className="tabular-nums">({task.subtasks.filter(s => s.done).length}/{task.subtasks.length})</span>
              </p>
              <div className="space-y-1.5">
                {task.subtasks.map(sub => (
                  <button key={sub.id} onClick={() => void handleToggleSubtask(sub.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--theme-text)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14}
                      style={{ color: sub.done ? 'var(--theme-success)' : 'var(--theme-border)', flexShrink: 0 }} />
                    <span className={cn('flex-1', sub.done && 'line-through text-[var(--theme-muted)]')}>{sub.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New subtask input */}
          <div className="flex gap-2">
            <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSubtask.trim()) { setNewSubtask(''); /* subtask creation handled on save */ } }}
              placeholder="Add subtask… (press Enter)"
              className={cn(inputCls, 'flex-1')} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-5 py-3.5">
          <button onClick={() => void handleDeleteTask()} disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--theme-danger,#ef4444)] transition-all duration-150 hover:bg-[var(--theme-hover)] disabled:opacity-50">
            <HugeiconsIcon icon={Delete01Icon} size={13} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
            <button onClick={() => void save()} disabled={saving}
              className={primaryBtnCls} style={primaryBtnStyle}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban board ──────────────────────────────────────────────────────────────

function KanbanBoard({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const taskKey = ['project-tasks', project.id]
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null)
  const [createInColumn, setCreateInColumn] = useState<TaskStatus | null>(null)

  const tasksQuery = useQuery({
    queryKey: taskKey,
    queryFn: () => fetchTasksForProject(project.id),
    staleTime: 30_000,
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: taskKey })

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(project.id, taskId, { status }),
    onSuccess: invalidate,
    onError: () => toast('Failed to update status', { type: 'error' }),
  })

  const tasks = tasksQuery.data ?? []
  const byStatus = (s: TaskStatus) => tasks.filter(t => t.status === s)

  return (
    <div className="flex-1">
      {tasksQuery.isLoading ? (
        <div className="animate-pulse grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TASK_STATUSES.map(col => {
            const colTasks = byStatus(col)
            const colColor = TASK_STATUS_COLORS[col]
            return (
              <div key={col} className="flex flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]" style={{ backdropFilter: 'blur(10px)' }}>
                {/* Column header — tinted with the column's status color */}
                <div className="flex items-center justify-between border-b px-3 py-2.5"
                  style={{
                    background: `color-mix(in srgb, ${colColor} 10%, var(--theme-card))`,
                    borderColor: `color-mix(in srgb, ${colColor} 25%, var(--theme-border))`,
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: colColor, boxShadow: `0 0 6px color-mix(in srgb, ${colColor} 60%, transparent)` }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text)]">{TASK_STATUS_LABELS[col]}</span>
                  </div>
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
                    style={{ background: `color-mix(in srgb, ${colColor} 16%, var(--theme-card))`, color: colColor }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Task cards */}
                <div className="flex flex-col gap-2 p-2">
                  <AnimatePresence mode="popLayout">
                    {colTasks.map(task => {
                      const overdue = isTaskOverdue(task)
                      return (
                        <motion.div key={task.id} layout
                          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                          onClick={() => setActiveTask(task)}
                          className="cursor-pointer rounded-lg border border-[var(--theme-border)] p-2.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                          style={{ background: 'var(--theme-input)' }}>
                          {/* Priority + title */}
                          <div className="flex items-start gap-1.5">
                            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIORITY_DOT[task.priority] }} />
                            <p className="flex-1 text-[12px] font-medium leading-snug text-[var(--theme-text)]">{task.title}</p>
                          </div>

                          {/* Description snippet */}
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-[10px] text-[var(--theme-muted)]">{task.description}</p>
                          )}

                          {/* Meta row — assignee initials + subtasks + due-date pill */}
                          <div className="mt-2 flex items-center gap-1.5">
                            {task.assignee && (
                              <span
                                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                style={{ background: ACCENT_GRADIENT }}
                                title={task.assignee}>
                                {initials(task.assignee)}
                              </span>
                            )}
                            {task.subtasks.length > 0 && (
                              <span className="text-[9px] tabular-nums text-[var(--theme-muted)]">
                                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subtasks
                              </span>
                            )}
                            {task.due_date && (
                              <span
                                className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
                                style={overdue
                                  ? { background: 'color-mix(in srgb, #ef4444 14%, var(--theme-card))', color: '#ef4444', border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)' }
                                  : { background: 'var(--theme-hover)', color: 'var(--theme-muted)', border: '1px solid var(--theme-border)' }}>
                                <HugeiconsIcon icon={Calendar03Icon} size={9} />
                                {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>

                          {/* Quick status move */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {TASK_STATUSES.filter(s => s !== col).map(s => (
                              <button key={s} onClick={e => { e.stopPropagation(); moveTaskMutation.mutate({ taskId: task.id, status: s }) }}
                                className="rounded border border-[var(--theme-border)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:border-transparent hover:text-white"
                                style={{ ['--hover-bg' as string]: TASK_STATUS_COLORS[s] }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = TASK_STATUS_COLORS[s]; (e.currentTarget as HTMLButtonElement).style.borderColor = TASK_STATUS_COLORS[s] }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.borderColor = '' }}
                                title={`Move to ${TASK_STATUS_LABELS[s]}`}>
                                → {TASK_STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {/* Add task button */}
                  <button onClick={() => setCreateInColumn(col)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
                    <HugeiconsIcon icon={Add01Icon} size={12} />
                    Add task
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          projectId={project.id}
          onClose={() => setActiveTask(null)}
          onUpdated={() => { invalidate(); setActiveTask(null) }}
        />
      )}
      {createInColumn && (
        <CreateTaskModal
          projectId={project.id}
          defaultStatus={createInColumn}
          onClose={() => setCreateInColumn(null)}
          onCreated={invalidate}
        />
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function ProjectsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const term = brand.id === 'hfm' ? 'Programs' : 'Projects'

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const projectsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchProjects({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const contactsQuery = useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: () => fetchContacts(),
    staleTime: 60_000,
  })

  const contactOptions = useMemo(
    () => (contactsQuery.data ?? []).map(c => ({ id: c.id, name: c.name })),
    [contactsQuery.data],
  )

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => { invalidate(); toast('Project saved'); setShowCreate(false) },
    onError: e => toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateProjectInput> }) => updateProject(p.id, p.updates),
    onSuccess: () => { invalidate(); toast('Project updated'); setEditing(null) },
    onError: e => toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => { invalidate(); toast('Project deleted') },
  })

  const filtered = useMemo(() => {
    const projects = projectsQuery.data ?? []
    if (statusFilter === 'all') return projects
    return projects.filter(p => p.status === statusFilter)
  }, [projectsQuery.data, statusFilter])

  const selectedProject = useMemo(
    () => (projectsQuery.data ?? []).find(p => p.id === selectedProjectId) ?? null,
    [projectsQuery.data, selectedProjectId],
  )

  const toForm = (p: Project): FormState => ({
    name: p.name, description: p.description, contact_id: p.contact_id ?? '',
    status: p.status, priority: p.priority, progress: p.progress,
    due_date: p.due_date ? p.due_date.slice(0, 10) : '', notes: p.notes,
  })

  const fromForm = (f: FormState): CreateProjectInput => {
    const contact = contactOptions.find(c => c.id === f.contact_id)
    return {
      name: f.name.trim(), description: f.description,
      contact_id: f.contact_id || null, contact_name: contact?.name ?? null,
      status: f.status, priority: f.priority, progress: f.progress,
      due_date: f.due_date ? new Date(f.due_date).toISOString() : null,
      notes: f.notes,
      brand: brand.id !== 'hermes' ? brand.id : undefined,
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">

        {/* ── Page header ── */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Briefcase01Icon} size={18} className="text-white" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">{term}</h1>
                <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                  {projectsQuery.data
                    ? `${projectsQuery.data.length} ${term.toLowerCase()} · track client work`
                    : 'Track client work end-to-end'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] p-0.5">
                <button onClick={() => setViewMode('list')}
                  className={cn('rounded-md p-1.5 transition-all duration-150', viewMode === 'list' ? 'text-white shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                  style={viewMode === 'list' ? { background: ACCENT_GRADIENT } : undefined}
                  title="List view">
                  <HugeiconsIcon icon={ListViewIcon} size={14} />
                </button>
                <button onClick={() => setViewMode('kanban')}
                  className={cn('rounded-md p-1.5 transition-all duration-150', viewMode === 'kanban' ? 'text-white shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                  style={viewMode === 'kanban' ? { background: ACCENT_GRADIENT } : undefined}
                  title="Kanban view">
                  <HugeiconsIcon icon={KanbanIcon} size={14} />
                </button>
              </div>
              <button onClick={invalidate} className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]" title="Refresh">
                <HugeiconsIcon icon={RefreshIcon} size={16} className="text-[var(--theme-muted)]" />
              </button>
              <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New {term === 'Programs' ? 'Program' : 'Project'}
              </button>
            </div>
          </div>

          {viewMode === 'list' && (
            <div className="flex w-fit items-center gap-0.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
              {(['all', ...STATUSES] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                    statusFilter === s ? '' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
                  style={statusFilter === s
                    ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }
                    : undefined}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
          {/* Kanban: project selector breadcrumb */}
          {viewMode === 'kanban' && selectedProject && (
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedProjectId(null)}
                className="text-[11px] text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]">
                ← All {term}
              </button>
              <span className="text-[11px] text-[var(--theme-muted)]">/</span>
              <span className="text-[11px] font-medium text-[var(--theme-text)]">{selectedProject.name}</span>
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                style={{ background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }}>
                Tasks
              </span>
            </div>
          )}
        </header>

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <div className="flex-1 space-y-2">
            {projectsQuery.isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-[var(--theme-card)] opacity-60" />
                ))}
              </div>
            ) : projectsQuery.isError ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #ef4444 18%, var(--theme-card)), color-mix(in srgb, #ef4444 6%, var(--theme-card)))' }}>
                  <HugeiconsIcon icon={AlertCircleIcon} size={26} style={{ color: '#ef4444' }} />
                </span>
                <p className="font-semibold text-[var(--theme-text)]">Couldn't load {term.toLowerCase()}</p>
                <p className="mt-1 text-sm text-[var(--theme-muted)] mb-4">
                  {projectsQuery.error instanceof Error ? projectsQuery.error.message : 'An error occurred'}
                </p>
                <button onClick={invalidate} className={primaryBtnCls} style={primaryBtnStyle}>
                  <HugeiconsIcon icon={RefreshIcon} size={14} />
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))' }}>
                  <HugeiconsIcon icon={Briefcase01Icon} size={26} className="text-[var(--theme-accent)]" />
                </span>
                <p className="font-semibold text-[var(--theme-text)]">
                  {statusFilter === 'all' ? `No ${term.toLowerCase()} yet` : `No ${STATUS_LABELS[statusFilter as Exclude<typeof statusFilter, 'all'>].toLowerCase()} ${term.toLowerCase()}`}
                </p>
                <p className="text-sm text-[var(--theme-muted)] mt-1 mb-4">
                  {statusFilter === 'all' ? 'Track client work by creating your first project.' : `No ${term.toLowerCase()} have this status.`}
                </p>
                {statusFilter === 'all' && (
                  <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
                    <HugeiconsIcon icon={Add01Icon} size={14} />
                    Create first {term === 'Programs' ? 'program' : 'project'}
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map(p => {
                  const pct = p.task_progress ?? p.progress
                  return (
                    <motion.div key={p.id} layout
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="group rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                      style={{ backdropFilter: 'blur(10px)' }}>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ background: PRIORITY_COLORS[p.priority] }} title={`${p.priority} priority`} />
                            <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">{p.name}</h3>
                            <ProjectStatusBadge status={p.status} />
                          </div>
                          {p.contact_name && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span
                                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                style={{ background: ACCENT_GRADIENT }}>
                                {initials(p.contact_name)}
                              </span>
                              <p className="truncate text-[11px] text-[var(--theme-muted)]">{p.contact_name}</p>
                            </div>
                          )}
                          {p.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-muted)]">{p.description}</p>}

                          {/* Thin gradient progress bar + % label */}
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                              <div className="h-full rounded-full transition-all duration-150"
                                style={{
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, ${STATUS_COLORS[p.status]}, color-mix(in srgb, ${STATUS_COLORS[p.status]} 60%, #000))`,
                                }} />
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: STATUS_COLORS[p.status] }}>
                              {pct}%
                            </span>
                          </div>

                          {/* Metric chips */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {p.task_count && p.task_count > 0 ? (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-hover)] px-2 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--theme-muted)]">
                                  <HugeiconsIcon icon={Task01Icon} size={9} />
                                  {p.task_count} tasks
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums"
                                  style={{ background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981', border: '1px solid color-mix(in srgb, #10b981 30%, transparent)' }}>
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} />
                                  {p.tasks_done ?? 0} done
                                </span>
                              </>
                            ) : null}
                            {p.due_date && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-hover)] px-2 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--theme-muted)]">
                                <HugeiconsIcon icon={Calendar03Icon} size={9} />
                                Due {formatDate(p.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          {/* Tasks button */}
                          <button onClick={e => { e.stopPropagation(); setSelectedProjectId(p.id); setViewMode('kanban') }}
                            className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-[var(--theme-accent)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                            title="View tasks">
                            Tasks →
                          </button>
                          <button onClick={e => { e.stopPropagation(); setEditing(p) }}
                            className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]" title="Edit">
                            <HugeiconsIcon icon={PencilEdit02Icon} size={14} className="text-[var(--theme-muted)]" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id) }}
                            className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]" title="Delete">
                            <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ── Kanban view ── */}
        {viewMode === 'kanban' && (
          <>
            {!selectedProject ? (
              /* Projects-by-status kanban overview */
              projectsQuery.isLoading ? (
                <div className="animate-pulse grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-64 rounded-xl bg-[var(--theme-card)] opacity-60" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {STATUSES.map(col => {
                    const colProjects = (projectsQuery.data ?? []).filter(p => p.status === col)
                    const resolvedColor = col === 'active'
                      ? brand.accentColor
                      : col === 'completed' ? '#10b981'
                      : col === 'on_hold' ? '#f59e0b'
                      : '#6b7280'
                    return (
                      <div key={col} className="flex flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]"
                        style={{ backdropFilter: 'blur(10px)' }}>
                        {/* Column header */}
                        <div className="flex items-center justify-between border-b px-3 py-2.5"
                          style={{
                            background: `color-mix(in srgb, ${resolvedColor} 10%, var(--theme-card))`,
                            borderColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--theme-border))`,
                          }}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: resolvedColor, boxShadow: `0 0 6px color-mix(in srgb, ${resolvedColor} 60%, transparent)` }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text)]">{STATUS_LABELS[col]}</span>
                          </div>
                          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
                            style={{ background: `color-mix(in srgb, ${resolvedColor} 16%, var(--theme-card))`, color: resolvedColor }}>
                            {colProjects.length}
                          </span>
                        </div>

                        {/* Project cards */}
                        <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)', minHeight: 80 }}>
                          <AnimatePresence mode="popLayout">
                            {colProjects.length === 0 ? (
                              <p className="py-6 text-center text-[10px] text-[var(--theme-muted)]">No {term.toLowerCase()}</p>
                            ) : colProjects.map(p => {
                              const pct = p.task_progress ?? p.progress
                              return (
                                <motion.div key={p.id} layout
                                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                                  className="rounded-lg border border-[var(--theme-border)] p-2.5 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                                  style={{ background: 'var(--theme-input)', cursor: 'default' }}>

                                  {/* Priority dot + name */}
                                  <div className="flex items-start gap-1.5">
                                    <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIORITY_COLORS[p.priority] }} title={`${p.priority} priority`} />
                                    <p className="flex-1 text-[12px] font-semibold leading-snug text-[var(--theme-text)]">{p.name}</p>
                                  </div>

                                  {/* Contact */}
                                  {p.contact_name && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
                                        style={{ background: ACCENT_GRADIENT }}>
                                        {initials(p.contact_name)}
                                      </span>
                                      <p className="truncate text-[10px] text-[var(--theme-muted)]">{p.contact_name}</p>
                                    </div>
                                  )}

                                  {/* Progress bar */}
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                                      <div className="h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${pct}%`,
                                          background: `linear-gradient(90deg, ${resolvedColor}, color-mix(in srgb, ${resolvedColor} 60%, #000))`,
                                        }} />
                                    </div>
                                    <span className="shrink-0 text-[9px] font-semibold tabular-nums" style={{ color: resolvedColor }}>{pct}%</span>
                                  </div>

                                  {/* Meta chips */}
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                    {p.task_count && p.task_count > 0 && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-hover)] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--theme-muted)]">
                                        <HugeiconsIcon icon={Task01Icon} size={8} />
                                        {p.tasks_done ?? 0}/{p.task_count}
                                      </span>
                                    )}
                                    {p.due_date && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-hover)] px-1.5 py-0.5 text-[9px] tabular-nums text-[var(--theme-muted)]">
                                        <HugeiconsIcon icon={Calendar03Icon} size={8} />
                                        {formatDate(p.due_date)}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => { setSelectedProjectId(p.id) }}
                                      className="ml-auto rounded border px-1.5 py-0.5 text-[9px] font-medium transition-all duration-150"
                                      style={{ borderColor: `color-mix(in srgb, ${resolvedColor} 30%, var(--theme-border))`, color: resolvedColor }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = resolvedColor; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = resolvedColor }}>
                                      Tasks →
                                    </button>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </AnimatePresence>

                          {/* Add project in this status */}
                          <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
                            <HugeiconsIcon icon={Add01Icon} size={12} />
                            Add {term === 'Programs' ? 'program' : 'project'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* Task kanban for selected project */
              <KanbanBoard project={selectedProject} />
            )}
          </>
        )}
      </div>

      <ProjectDialog open={showCreate} initial={EMPTY_FORM} title={`New ${term === 'Programs' ? 'Program' : 'Project'}`}
        contacts={contactOptions} onClose={() => setShowCreate(false)}
        onSubmit={f => createMutation.mutate(fromForm(f))} isSubmitting={createMutation.isPending} />
      <ProjectDialog open={editing !== null} initial={editing ? toForm(editing) : EMPTY_FORM}
        title={`Edit ${term === 'Programs' ? 'Program' : 'Project'}`}
        contacts={contactOptions} onClose={() => setEditing(null)}
        onSubmit={f => { if (editing) updateMutation.mutate({ id: editing.id, updates: fromForm(f) }) }}
        isSubmitting={updateMutation.isPending} />
    </div>
  )
}
