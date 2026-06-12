/**
 * Dev Studio — run Claude Code / Codex as headless coding agents on the server.
 * Left pane: agent status, task composer, task history. Right pane: live log.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  ComputerTerminal01Icon,
  RefreshIcon,
  Rocket01Icon,
  SourceCodeIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type DevAgent = 'claude' | 'codex'
type DevTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

interface DevTask {
  id: string
  agent: DevAgent
  prompt: string
  workspace: string
  status: DevTaskStatus
  exit_code?: number
  started_at?: string
  finished_at?: string
  duration_ms?: number
  created_at: string
}

interface DevStatus {
  claude_installed: boolean
  codex_installed: boolean
  anthropic_key_set: boolean
  openai_key_set: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGENT_LABELS: Record<DevAgent, string> = { claude: 'Claude Code', codex: 'Codex' }
const AGENT_EMOJI: Record<DevAgent, string> = { claude: '🟣', codex: '⚪️' }

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function durationLabel(ms?: number): string | null {
  if (typeof ms !== 'number') return null
  if (ms < 1000) return '<1s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const STATUS_DOT: Record<DevTaskStatus, string> = {
  queued: 'bg-gray-400',
  running: 'bg-amber-400 animate-pulse',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-[var(--theme-muted)] opacity-50',
}

function StatusDot({ status }: { status: DevTaskStatus }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status])} />
}

function agentReady(status: DevStatus | undefined, agent: DevAgent): { ready: boolean; missing: string } {
  if (!status) return { ready: false, missing: 'checking…' }
  const installed = agent === 'claude' ? status.claude_installed : status.codex_installed
  const keySet = agent === 'claude' ? status.anthropic_key_set : status.openai_key_set
  const keyName = agent === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
  const missing: string[] = []
  if (!installed) missing.push('CLI not installed')
  if (!keySet) missing.push(`${keyName} not set`)
  return { ready: missing.length === 0, missing: missing.join(' · ') }
}

const LIVE_APP_PATH = '/opt/ai-os'
const STAGING_PATH = '/opt/ai-os-staging'

type WorkspaceMode = 'fresh' | 'staging' | 'custom'

// ── Self-update types ─────────────────────────────────────────────────────────

type SelfDeployStatus = 'running' | 'deployed' | 'rolled_back' | 'failed'

interface SelfDeployRecord {
  id: string
  status: SelfDeployStatus
  exit_code?: number
  started_at: string
  finished_at?: string
}

interface SelfUpdateStatus {
  server: boolean
  staging: { exists: boolean; path: string }
  last_deploy: SelfDeployRecord | null
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function DevStudioScreen() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const brandQ = `?brand=${brand.id}`

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agent, setAgent] = useState<DevAgent>('claude')
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('fresh')
  const [workspace, setWorkspace] = useState('')

  const statusQuery = useQuery<DevStatus>({
    queryKey: ['dev', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/dev/status')
      if (!res.ok) throw new Error('Failed to load agent status')
      return res.json()
    },
    refetchInterval: 30_000,
  })
  const status = statusQuery.data

  const tasksQuery = useQuery<DevTask[]>({
    queryKey: ['dev', 'tasks', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/dev/tasks${brandQ}`)
      if (!res.ok) throw new Error('Failed to load tasks')
      const d = (await res.json()) as { tasks?: DevTask[] }
      return d.tasks ?? []
    },
    refetchInterval: 5000,
  })
  const tasks = tasksQuery.data ?? []
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dev/tasks${brandQ}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          prompt: prompt.trim(),
          workspace:
            workspaceMode === 'staging'
              ? STAGING_PATH
              : workspaceMode === 'custom'
                ? workspace.trim() || undefined
                : undefined,
        }),
      })
      const d = (await res.json()) as { task?: DevTask; error?: string }
      if (!res.ok || !d.task) throw new Error(d.error ?? 'Failed to start task')
      return d.task
    },
    onSuccess: (task) => {
      setPrompt('')
      setSelectedId(task.id)
      void queryClient.invalidateQueries({ queryKey: ['dev', 'tasks', brand.id] })
      toast(`${AGENT_LABELS[task.agent]} task started`)
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to start task', { type: 'error' }),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dev/tasks/${id}/cancel${brandQ}`, { method: 'POST' })
      const d = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Failed to cancel task')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dev', 'tasks', brand.id] })
      toast('Task cancelled')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to cancel task', { type: 'error' }),
  })

  const selectedAgentState = agentReady(status, agent)
  const canRun = selectedAgentState.ready && prompt.trim().length > 0 && !runMutation.isPending

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left pane ── */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-[var(--theme-border)] bg-[var(--theme-card)]">
        <div className="px-4 pb-2 pt-4">
          <h1 className="text-[15px] font-bold text-[var(--theme-text)]">Dev Studio</h1>
          <div className="mt-2 flex gap-1.5">
            {(['claude', 'codex'] as const).map((a) => {
              const s = agentReady(status, a)
              return (
                <span
                  key={a}
                  title={s.ready ? `${AGENT_LABELS[a]} ready` : s.missing}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    s.ready
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                      : 'border-[var(--theme-border)] text-[var(--theme-muted)]'
                  )}
                >
                  {AGENT_LABELS[a]} {s.ready ? '✓' : '✗'}
                </span>
              )
            })}
          </div>
        </div>

        {/* ── New task composer ── */}
        <div className="mx-3 mb-3 rounded-xl border border-[var(--theme-border)] p-2.5">
          <div className="flex gap-1.5">
            {(['claude', 'codex'] as const).map((a) => {
              const s = agentReady(status, a)
              return (
                <button
                  key={a}
                  disabled={!s.ready}
                  title={s.ready ? undefined : s.missing}
                  onClick={() => setAgent(a)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
                    agent === a
                      ? 'border-[var(--theme-accent)] text-[var(--theme-text)]'
                      : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                    !s.ready && 'cursor-not-allowed opacity-40'
                  )}
                  style={agent === a ? { background: 'var(--theme-accent-soft)' } : undefined}
                >
                  {AGENT_EMOJI[a]} {AGENT_LABELS[a]}
                </button>
              )
            })}
          </div>
          {!selectedAgentState.ready && (
            <p className="mt-1.5 text-[10px] text-[var(--theme-muted)]">
              {AGENT_LABELS[agent]}: {selectedAgentState.missing}
            </p>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the coding task…"
            rows={4}
            className="mt-2 w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-2 text-[12px] text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted)] focus:border-[var(--theme-accent)]"
          />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-1 text-[11px] text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
          >
            {showAdvanced ? '▾' : '▸'} Advanced
          </button>
          {showAdvanced && (
            <div className="mt-1.5">
              <div className="flex gap-1">
                {(
                  [
                    { mode: 'fresh' as const, label: 'Fresh workspace' },
                    { mode: 'staging' as const, label: 'OS staging' },
                    { mode: 'custom' as const, label: 'Custom path' },
                  ]
                ).map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setWorkspaceMode(mode)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      workspaceMode === mode
                        ? mode === 'staging'
                          ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                          : 'border-[var(--theme-accent)] bg-[var(--theme-hover)] text-[var(--theme-text)]'
                        : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {workspaceMode === 'fresh' && (
                <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
                  A fresh per-task directory on the server.
                </p>
              )}
              {workspaceMode === 'staging' && (
                <p className="mt-1 text-[10px] font-medium text-purple-400">
                  self-update — agent works in {STAGING_PATH}; promote with Build &amp; Deploy below.
                </p>
              )}
              {workspaceMode === 'custom' && (
                <>
                  <input
                    value={workspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    placeholder="auto: fresh workspace"
                    className="mt-1.5 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-[11px] text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted)] focus:border-[var(--theme-accent)]"
                  />
                  <p className="mt-1 text-[10px] text-[var(--theme-muted)]">
                    Absolute path on the server. Leave blank for a fresh per-task workspace.
                  </p>
                  {workspace.trim().replace(/\/+$/, '') === LIVE_APP_PATH && (
                    <p className="mt-1 text-[10px] font-medium text-amber-500">
                      ⚠ This is the live app directory — the agent may modify the running OS.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={() => runMutation.mutate()}
            disabled={!canRun}
            className={cn(
              'mt-2 w-full rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition-opacity',
              !canRun && 'cursor-not-allowed opacity-40'
            )}
            style={{ background: 'var(--theme-accent)' }}
          >
            {runMutation.isPending ? 'Starting…' : 'Run Task'}
          </button>
        </div>

        {/* ── OS Updates (self-update pipeline) ── */}
        <OSUpdatesPanel brandQ={brandQ} accentColor={brand.accentColor} />

        {/* ── Task history ── */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
            Tasks
          </div>
          {tasks.length === 0 && (
            <p className="px-2 text-[11px] text-[var(--theme-muted)]">No tasks yet.</p>
          )}
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={cn(
                'mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                t.id === selectedId ? 'bg-[var(--theme-hover)]' : 'hover:bg-[var(--theme-hover)]'
              )}
            >
              <div className="flex items-center gap-1.5">
                <StatusDot status={t.status} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                  {AGENT_LABELS[t.agent]}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-[var(--theme-muted)]">
                  {relativeTime(t.created_at)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--theme-text)]">{t.prompt}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right pane ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedTask ? (
          <TaskDetail
            task={selectedTask}
            brandQ={brandQ}
            onCancel={() => cancelMutation.mutate(selectedTask.id)}
            cancelling={cancelMutation.isPending}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, var(--theme-accent), #000)' }}
            >
              <HugeiconsIcon icon={ComputerTerminal01Icon} size={22} />
            </div>
            <p className="text-[14px] font-semibold text-[var(--theme-text)]">Run your first agent task</p>
            <p className="max-w-xs text-[12px] text-[var(--theme-muted)]">
              Describe a coding task on the left and Claude Code or Codex will run it headlessly on the server.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task detail + live log ────────────────────────────────────────────────────

function TaskDetail({
  task,
  brandQ,
  onCancel,
  cancelling,
}: {
  task: DevTask
  brandQ: string
  onCancel: () => void
  cancelling: boolean
}) {
  const isActive = task.status === 'queued' || task.status === 'running'
  const [log, setLog] = useState('')
  const offsetRef = useRef(0)
  const logBoxRef = useRef<HTMLDivElement | null>(null)
  const userScrolledUpRef = useRef(false)

  // reset when switching tasks
  useEffect(() => {
    setLog('')
    offsetRef.current = 0
    userScrolledUpRef.current = false
  }, [task.id])

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev/tasks/${task.id}/log${brandQ}&offset=${offsetRef.current}`)
      if (!res.ok) return
      const d = (await res.json()) as { content: string; size: number }
      if (d.content) setLog((prev) => prev + d.content)
      offsetRef.current = d.size
    } catch {
      // transient poll failure — try again next tick
    }
  }, [task.id, brandQ])

  // initial load + poll while active
  useEffect(() => {
    void fetchLog()
    if (!isActive) return
    const t = setInterval(() => void fetchLog(), 2000)
    return () => clearInterval(t)
  }, [fetchLog, isActive])

  // one final fetch when the task reaches a terminal state
  useEffect(() => {
    if (!isActive) void fetchLog()
  }, [isActive, fetchLog])

  // auto-scroll unless the user scrolled up
  useEffect(() => {
    const box = logBoxRef.current
    if (box && !userScrolledUpRef.current) box.scrollTop = box.scrollHeight
  }, [log])

  const onScroll = () => {
    const box = logBoxRef.current
    if (!box) return
    userScrolledUpRef.current = box.scrollTop + box.clientHeight < box.scrollHeight - 40
  }

  const duration = durationLabel(
    task.duration_ms ??
      (task.started_at && isActive ? Date.now() - new Date(task.started_at).getTime() : undefined)
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b border-[var(--theme-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={SourceCodeIcon} size={15} className="text-[var(--theme-muted)]" />
            <span className="text-[13px] font-semibold text-[var(--theme-text)]">
              {AGENT_LABELS[task.agent]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--theme-muted)]">
              <StatusDot status={task.status} />
              {task.status}
              {typeof task.exit_code === 'number' && task.status !== 'completed' && ` (exit ${task.exit_code})`}
            </span>
            {duration && <span className="text-[11px] text-[var(--theme-muted)]">{duration}</span>}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--theme-muted)]" title={task.workspace}>
            {task.workspace}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] text-[var(--theme-text)]">{task.prompt}</p>
        </div>
        {isActive && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} />
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>

      <div
        ref={logBoxRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-[#0d1117] p-4"
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#c9d1d9]">
          {log || (isActive ? 'Waiting for output…' : 'No output captured.')}
        </pre>
      </div>
    </div>
  )
}

// ── OS Updates panel (self-update pipeline) ───────────────────────────────────

const DEPLOY_BADGE: Record<SelfDeployStatus, { color: string; label: string }> = {
  running: { color: '#f59e0b', label: 'deploying…' },
  deployed: { color: '#10b981', label: 'deployed' },
  rolled_back: { color: '#f59e0b', label: 'rolled back' },
  failed: { color: '#ef4444', label: 'failed' },
}

function DeployBadge({ status }: { status: SelfDeployStatus }) {
  const { color, label } = DEPLOY_BADGE[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`, color }}
    >
      <span
        className={cn('inline-block h-1.5 w-1.5 rounded-full', status === 'running' && 'animate-pulse')}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

function OSUpdatesPanel({ brandQ, accentColor }: { brandQ: string; accentColor: string }) {
  const queryClient = useQueryClient()
  const [showLog, setShowLog] = useState(false)

  const statusQuery = useQuery<SelfUpdateStatus>({
    queryKey: ['self-update', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/self-update/status')
      if (!res.ok) throw new Error('Failed to load self-update status')
      return res.json()
    },
    refetchInterval: (q) => (q.state.data?.last_deploy?.status === 'running' ? 3000 : 20_000),
  })
  const status = statusQuery.data
  const lastDeploy = status?.last_deploy ?? null
  const deploying = lastDeploy?.status === 'running'

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['self-update', 'status'] })

  const deployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/self-update/deploy${brandQ}`, { method: 'POST' })
      const d = (await res.json()) as { id?: string; note?: string }
      if (!res.ok || !d.id) throw new Error(d.note ?? 'Failed to start deploy')
      return d.id
    },
    onSuccess: () => {
      setShowLog(true)
      invalidate()
      toast('Build & Deploy started')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to start deploy', { type: 'error' }),
  })

  const stagingMutation = useMutation({
    mutationFn: async (action: 'ensure' | 'reset') => {
      const res = await fetch(`/api/self-update/staging/${action}`, { method: 'POST' })
      const d = (await res.json()) as { ok?: boolean; note?: string }
      if (!res.ok || !d.ok) throw new Error(d.note ?? `Failed to ${action} staging`)
      return d.note ?? 'OK'
    },
    onSuccess: (note) => {
      invalidate()
      toast(note)
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Staging action failed', { type: 'error' }),
  })

  // hide entirely on local dev (no /opt/ai-os) once status is known
  if (status && !status.server) return null

  const onDeploy = () => {
    if (
      window.confirm(
        'This rebuilds and restarts the live platform. Auto-rollback protects you. Continue?'
      )
    ) {
      deployMutation.mutate()
    }
  }

  const onReset = () => {
    if (
      window.confirm(
        'Reset staging from live? Any un-deployed agent work in /opt/ai-os-staging will be overwritten.'
      )
    ) {
      stagingMutation.mutate('reset')
    }
  }

  return (
    <div className="mx-3 mb-3 rounded-xl border border-[var(--theme-border)] p-2.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 38%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={Rocket01Icon} size={13} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          OS Updates
        </span>
        {lastDeploy && (
          <span className="ml-auto">
            <DeployBadge status={lastDeploy.status} />
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[10px] text-[var(--theme-muted)]">
        {status
          ? status.staging.exists
            ? `Staging ready at ${status.staging.path}`
            : 'No staging workspace yet — create one to start improving the OS safely.'
          : 'Checking staging status…'}
      </p>
      {lastDeploy?.status === 'rolled_back' && (
        <p className="mt-1 text-[10px] font-medium text-amber-500">
          Last deploy rolled back — live platform untouched.
        </p>
      )}

      <div className="mt-2 flex gap-1.5">
        {status && !status.staging.exists ? (
          <button
            onClick={() => stagingMutation.mutate('ensure')}
            disabled={stagingMutation.isPending}
            className="flex-1 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
          >
            {stagingMutation.isPending ? 'Creating…' : 'Create staging from live'}
          </button>
        ) : (
          <>
            <button
              onClick={onDeploy}
              disabled={!status?.staging.exists || deploying || deployMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 65%, #000))`,
                boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 38%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={Rocket01Icon} size={12} />
              {deploying ? 'Deploying…' : deployMutation.isPending ? 'Starting…' : 'Build & Deploy to Live'}
            </button>
            <button
              onClick={onReset}
              disabled={stagingMutation.isPending || deploying}
              title="Overwrite staging source with the current live app"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] disabled:opacity-50"
            >
              <HugeiconsIcon icon={RefreshIcon} size={12} />
              Reset
            </button>
          </>
        )}
      </div>

      {lastDeploy && (
        <button
          onClick={() => setShowLog((v) => !v)}
          className="mt-1.5 text-[10px] text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
        >
          {showLog ? '▾ Hide deploy log' : '▸ Show deploy log'}
        </button>
      )}
      {showLog && lastDeploy && <DeployLog deployId={lastDeploy.id} active={deploying} />}
    </div>
  )
}

function DeployLog({ deployId, active }: { deployId: string; active: boolean }) {
  const [log, setLog] = useState('')
  const offsetRef = useRef(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLog('')
    offsetRef.current = 0
  }, [deployId])

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/self-update/deploys/${deployId}/log?offset=${offsetRef.current}`)
      if (!res.ok) return
      const d = (await res.json()) as { content: string; size: number }
      if (d.content) setLog((prev) => prev + d.content)
      offsetRef.current = d.size
    } catch {
      // transient poll failure (e.g. server restarting mid-deploy) — retry next tick
    }
  }, [deployId])

  useEffect(() => {
    void fetchLog()
    if (!active) return
    const t = setInterval(() => void fetchLog(), 2000)
    return () => clearInterval(t)
  }, [fetchLog, active])

  // one final fetch when the deploy finishes
  useEffect(() => {
    if (!active) void fetchLog()
  }, [active, fetchLog])

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [log])

  return (
    <div ref={boxRef} className="mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-[#0d1117] p-2">
      <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[#c9d1d9]">
        {log || (active ? 'Waiting for pipeline output…' : 'No log output.')}
      </pre>
    </div>
  )
}
