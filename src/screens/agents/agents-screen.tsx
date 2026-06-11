import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading03Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  fetchAgents, fetchTasks, updateTask, orchestrate,
  type AgentDef, type AgentTask, type TaskStatus,
} from '@/lib/agents-api'

const COLUMNS: { status: TaskStatus; label: string; color: string; icon: typeof Clock01Icon }[] = [
  { status: 'queued', label: 'Queued', color: 'var(--theme-muted)', icon: Clock01Icon },
  { status: 'running', label: 'Running', color: 'var(--theme-accent)', icon: Loading03Icon },
  { status: 'review', label: 'Review', color: 'var(--theme-warning)', icon: AlertCircleIcon },
  { status: 'done', label: 'Done', color: 'var(--theme-success)', icon: CheckmarkCircle01Icon },
]

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  urgent: { bg: 'rgba(240,68,68,0.15)', text: 'var(--theme-danger)' },
  high: { bg: 'rgba(240,160,48,0.15)', text: 'var(--theme-warning)' },
  normal: { bg: 'rgba(var(--theme-accent-rgb, 100,200,100),0.1)', text: 'var(--theme-muted)' },
  low: { bg: 'transparent', text: 'var(--theme-muted)' },
}

export function AgentsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [goalInput, setGoalInput] = useState('')
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [showGoalModal, setShowGoalModal] = useState(false)

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: fetchAgents })
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: () => fetchTasks(),
    refetchInterval: 8000,
  })

  const orchestrateMut = useMutation({
    mutationFn: (goal: string) => orchestrate(goal),
    onSuccess: (data) => {
      toast(`Hermes created ${data.tasks.length} tasks`)
      qc.invalidateQueries({ queryKey: ['agent-tasks'] })
      setGoalInput('')
      setShowGoalModal(false)
    },
    onError: (e) => toast((e as Error).message, { type: 'error' }),
  })

  const moveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-tasks'] }),
  })

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentDef>()
    for (const a of agents) m.set(a.id, a)
    return m
  }, [agents])

  const filtered = useMemo(() => {
    if (filterAgent === 'all') return tasks
    return tasks.filter(t => t.agent_id === filterAgent)
  }, [tasks, filterAgent])

  const columns = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      tasks: filtered
        .filter(t => t.status === col.status)
        .sort((a, b) => {
          const prio = ['urgent', 'high', 'normal', 'low']
          return prio.indexOf(a.priority) - prio.indexOf(b.priority)
        }),
    }))
  }, [filtered])

  const activeAgents = agents.filter(a => a.active)
  const totalTasks = tasks.length
  const runningCount = tasks.filter(t => t.status === 'running').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  function moveTask(taskId: string, newStatus: TaskStatus) {
    moveMut.mutate({ id: taskId, status: newStatus })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className="border-b px-6 py-4"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={AiMagicIcon} size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-[var(--theme-text)]">Agent Swarm</h1>
              <p className="text-[12px] text-[var(--theme-muted)]">
                {activeAgents.length} agents · {runningCount} running · {doneCount}/{totalTasks} complete
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Agent filter pills */}
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setFilterAgent('all')}
                className="shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all"
                style={{
                  borderColor: filterAgent === 'all' ? 'var(--theme-accent)' : 'var(--theme-border)',
                  background: filterAgent === 'all' ? 'var(--theme-accent-soft)' : 'transparent',
                  color: filterAgent === 'all' ? 'var(--theme-accent)' : 'var(--theme-muted)',
                }}
              >
                All
              </button>
              {activeAgents.map(a => (
                <button
                  key={a.id}
                  onClick={() => setFilterAgent(a.id)}
                  className="shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={{
                    borderColor: filterAgent === a.id ? 'var(--theme-accent)' : 'var(--theme-border)',
                    background: filterAgent === a.id ? 'var(--theme-accent-soft)' : 'transparent',
                    color: filterAgent === a.id ? 'var(--theme-accent)' : 'var(--theme-muted)',
                  }}
                >
                  {a.avatar_emoji} {a.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowGoalModal(true)}
              className="btn-primary flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold"
            >
              <HugeiconsIcon icon={AiMagicIcon} size={14} />
              New Goal
            </button>
          </div>
        </div>
      </header>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin text-[var(--theme-muted)]" />
          </div>
        ) : (
          <div className="flex h-full gap-3" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
            {columns.map(col => (
              <div
                key={col.status}
                className="flex w-[280px] shrink-0 flex-col rounded-xl border"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={col.icon} size={14} style={{ color: col.color }} />
                    <span className="text-[12px] font-semibold text-[var(--theme-text)]">{col.label}</span>
                  </div>
                  <span
                    className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                    style={{ background: `color-mix(in srgb, ${col.color} 15%, transparent)`, color: col.color }}
                  >
                    {col.tasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {col.tasks.length === 0 && (
                    <p className="py-8 text-center text-[11px] text-[var(--theme-muted)]">
                      No tasks
                    </p>
                  )}
                  {col.tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agent={agentMap.get(task.agent_id)}
                      onMove={moveTask}
                      accentColor={brand.accentColor}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goal orchestration modal */}
      {showGoalModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowGoalModal(false)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-2xl border p-6"
            style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={AiMagicIcon} size={18} style={{ color: brand.accentColor }} />
                <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">Give Hermes a goal</h2>
              </div>
              <button onClick={() => setShowGoalModal(false)} className="text-[var(--theme-muted)]">
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </button>
            </div>
            <p className="mt-1 text-[12px] text-[var(--theme-muted)]">
              Hermes will decompose your goal into tasks and assign them to the right agents.
            </p>
            <textarea
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              placeholder="e.g. Follow up with all leads from this week, draft social posts for the weekend, and send invoice reminders for overdue accounts"
              rows={4}
              className="mt-4 w-full rounded-xl border px-4 py-3 text-[13px] leading-relaxed outline-none"
              style={{
                background: 'var(--theme-input)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="rounded-xl border px-4 py-2 text-[12px] font-medium"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => goalInput.trim() && orchestrateMut.mutate(goalInput.trim())}
                disabled={!goalInput.trim() || orchestrateMut.isPending}
                className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold"
              >
                {orchestrateMut.isPending ? (
                  <><HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" /> Planning...</>
                ) : (
                  <><HugeiconsIcon icon={AiMagicIcon} size={14} /> Deploy Agents</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({
  task,
  agent,
  onMove,
  accentColor,
}: {
  task: AgentTask
  agent?: AgentDef
  onMove: (id: string, status: TaskStatus) => void
  accentColor: string
}) {
  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    queued: 'running',
    running: 'review',
    review: 'done',
    done: null,
    failed: 'queued',
  }
  const next = nextStatus[task.status]
  const pBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.normal

  return (
    <div
      className="group rounded-xl border p-3 transition-all hover:border-[var(--theme-accent)]"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)' }}
    >
      {/* Agent badge + priority */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--theme-muted)]">
          <span>{agent?.avatar_emoji ?? '🤖'}</span>
          <span>{agent?.name ?? 'Unknown'}</span>
        </span>
        {task.priority !== 'normal' && (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: pBadge.bg, color: pBadge.text }}
          >
            {task.priority}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="mt-1.5 text-[12px] font-medium leading-snug text-[var(--theme-text)]">
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--theme-muted)]">
          {task.description}
        </p>
      )}

      {/* Result preview */}
      {task.result && (
        <div
          className="mt-2 rounded-lg px-2 py-1.5 text-[10px] leading-relaxed"
          style={{ background: 'color-mix(in srgb, var(--theme-success) 10%, transparent)', color: 'var(--theme-success)' }}
        >
          {task.result.slice(0, 120)}{task.result.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div
          className="mt-2 rounded-lg px-2 py-1.5 text-[10px] leading-relaxed"
          style={{ background: 'color-mix(in srgb, var(--theme-danger) 10%, transparent)', color: 'var(--theme-danger)' }}
        >
          {task.error.slice(0, 100)}
        </div>
      )}

      {/* Actions */}
      {next && (
        <div className="mt-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onMove(task.id, next)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-all"
            style={{
              background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
              color: accentColor,
            }}
          >
            {task.status === 'failed' ? 'Retry' : `Move to ${next}`}
            <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
          </button>
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-1.5 text-[9px] text-[var(--theme-muted)]" style={{ opacity: 0.6 }}>
        {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
