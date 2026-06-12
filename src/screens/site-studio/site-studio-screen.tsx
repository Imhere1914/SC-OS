/**
 * Site Studio — a Lovable-style interface for editing the marketing websites in
 * natural language. LEFT: a chat-like prompt panel + a running list of edit
 * requests (each backed by a Dev Studio agent task, expandable to the live log).
 * RIGHT: a live preview iframe of the deployed site. Action bar builds, deploys,
 * and reverts. Reuses the Dev Studio agent runner via /api/dev/tasks polling.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Globe02Icon,
  RefreshIcon,
  Rocket01Icon,
  SentIcon,
  SparklesIcon,
  ArrowTurnBackwardIcon,
  SourceCodeIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type SiteKey = 'sc' | 'hfm'
type DevTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

interface SiteCommit {
  hash: string
  subject: string
}

interface SiteStatus {
  key: SiteKey
  name: string
  url: string
  lastCommits: SiteCommit[]
}

interface SiteStudioStatus {
  server: boolean
  sites: SiteStatus[]
}

interface DevTask {
  id: string
  prompt: string
  status: DevTaskStatus
  created_at: string
}

// the human prompt the user typed (we strip the agent preamble for display)
interface EditRequest {
  taskId: string
  prompt: string
  site: SiteKey
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DevTaskStatus, string> = {
  queued: 'queued',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  cancelled: 'cancelled',
}

const STATUS_COLOR: Record<DevTaskStatus, string> = {
  queued: '#94a3b8',
  running: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#94a3b8',
}

const EXAMPLE_PROMPTS = [
  'Change the hero headline to…',
  'Add a testimonials section',
  'Make the CTA buttons larger and green',
  'Add a new pricing tier',
]

// ── localStorage for the per-site edit-request list ─────────────────────────────

function loadEdits(site: SiteKey): EditRequest[] {
  try {
    const raw = localStorage.getItem(`site-studio-edits-${site}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as EditRequest[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveEdits(site: SiteKey, edits: EditRequest[]): void {
  try {
    localStorage.setItem(`site-studio-edits-${site}`, JSON.stringify(edits.slice(0, 30)))
  } catch {
    // storage full / unavailable — non-fatal
  }
}

// ── Screen ──────────────────────────────────────────────────────────────────────

export function SiteStudioScreen() {
  const brand = useBrand()
  const accent = brand.accentColor
  const queryClient = useQueryClient()

  const [site, setSite] = useState<SiteKey>('sc')
  const [prompt, setPrompt] = useState('')
  const [edits, setEdits] = useState<EditRequest[]>(() => loadEdits('sc'))
  const [iframeKey, setIframeKey] = useState(0)
  const [buildOutput, setBuildOutput] = useState<{ ok: boolean; log: string } | null>(null)

  const brandQ = `?brand=site-${site}`

  // reload the per-site edit list when switching sites
  useEffect(() => {
    setEdits(loadEdits(site))
    setBuildOutput(null)
  }, [site])

  const statusQuery = useQuery<SiteStudioStatus>({
    queryKey: ['site-studio', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/site-studio/status')
      if (!res.ok) throw new Error('Failed to load Site Studio status')
      return res.json()
    },
    refetchInterval: 30_000,
  })
  const status = statusQuery.data
  const sites = status?.sites ?? []
  const current = sites.find((s) => s.key === site)
  const siteName = current?.name ?? (site === 'sc' ? 'Simple Connect' : 'Holistic Functional Care')
  const siteUrl = current?.url ?? ''

  const persistEdits = useCallback(
    (next: EditRequest[]) => {
      setEdits(next)
      saveEdits(site, next)
    },
    [site]
  )

  const editMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/site-studio/${site}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      })
      const d = (await res.json()) as { taskId?: string; error?: string }
      if (!res.ok || !d.taskId) throw new Error(d.error ?? 'Failed to start edit')
      return { taskId: d.taskId, prompt: text }
    },
    onSuccess: ({ taskId, prompt: text }) => {
      persistEdits([{ taskId, prompt: text, site }, ...edits])
      setPrompt('')
      toast('Edit started — Claude is working on your site')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to start edit', { type: 'error' }),
  })

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/site-studio/${site}/build`, { method: 'POST' })
      return (await res.json()) as { ok: boolean; log: string }
    },
    onSuccess: (d) => {
      setBuildOutput(d)
      if (d.ok) {
        toast('Build succeeded — reloading preview')
        setIframeKey((k) => k + 1)
      } else {
        toast('Build failed — see output', { type: 'error' })
      }
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Build failed', { type: 'error' }),
  })

  const deployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/site-studio/${site}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: edits[0]?.prompt }),
      })
      return (await res.json()) as { ok: boolean; log: string; commitHash?: string }
    },
    onSuccess: (d) => {
      setBuildOutput(d)
      if (d.ok) {
        toast(`Published to live${d.commitHash ? ` (${d.commitHash})` : ''}`)
        setIframeKey((k) => k + 1)
        void queryClient.invalidateQueries({ queryKey: ['site-studio', 'status'] })
      } else {
        toast('Deploy failed — see output', { type: 'error' })
      }
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Deploy failed', { type: 'error' }),
  })

  const revertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/site-studio/${site}/revert`, { method: 'POST' })
      return (await res.json()) as { ok: boolean; log: string }
    },
    onSuccess: (d) => {
      setBuildOutput(d)
      if (d.ok) {
        toast('Reverted last change and redeployed')
        setIframeKey((k) => k + 1)
        void queryClient.invalidateQueries({ queryKey: ['site-studio', 'status'] })
      } else {
        toast('Revert failed — see output', { type: 'error' })
      }
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Revert failed', { type: 'error' }),
  })

  const onSend = () => {
    const text = prompt.trim()
    if (!text || editMutation.isPending) return
    editMutation.mutate(text)
  }

  const onDeploy = () => {
    if (window.confirm(`Publish changes to ${siteUrl}?`)) deployMutation.mutate()
  }

  const onRevert = () => {
    if (window.confirm('Revert the last Site Studio change and redeploy? This cannot be undone.'))
      revertMutation.mutate()
  }

  const gradient = `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))`
  const glow = `0 2px 8px color-mix(in srgb, ${accent} 38%, transparent)`
  const busy = buildMutation.isPending || deployMutation.isPending || revertMutation.isPending

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Header + site switcher ── */}
      <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-4 py-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: gradient, boxShadow: glow }}
        >
          <HugeiconsIcon icon={Globe02Icon} size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold leading-tight text-[var(--theme-text)]">Site Studio</h1>
          <p className="truncate text-[11px] text-[var(--theme-muted)]">
            Describe a change and Claude edits your live website
          </p>
        </div>

        <div className="ml-auto flex rounded-lg border border-[var(--theme-border)] p-0.5">
          {(['sc', 'hfm'] as const).map((k) => {
            const s = sites.find((x) => x.key === k)
            const label = s?.name ?? (k === 'sc' ? 'Simple Connect' : 'Holistic Functional Care')
            return (
              <button
                key={k}
                onClick={() => setSite(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  site === k
                    ? 'text-[var(--theme-text)]'
                    : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]'
                )}
                style={site === k ? { background: 'var(--theme-accent-soft)' } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {status && !status.server && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          Site Studio runs against the staged site repos on the server — these are not present in this
          environment, so edits and deploys are disabled here.
        </div>
      )}

      {/* ── Split: prompt panel | preview ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT: chat-like prompt + edit list */}
        <div className="flex w-[380px] shrink-0 flex-col border-r border-[var(--theme-border)] bg-[var(--theme-card)]">
          <div className="border-b border-[var(--theme-border)] p-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend()
              }}
              placeholder="Describe a change to your website…"
              rows={4}
              className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-[13px] text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted)] focus:border-[var(--theme-accent)]"
            />

            {/* example prompt chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 30%, var(--theme-border))`,
                    background: `color-mix(in srgb, ${accent} 6%, transparent)`,
                  }}
                >
                  <HugeiconsIcon icon={SparklesIcon} size={10} />
                  {ex}
                </button>
              ))}
            </div>

            <button
              onClick={onSend}
              disabled={!prompt.trim() || editMutation.isPending}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: gradient, boxShadow: glow }}
            >
              <HugeiconsIcon icon={SentIcon} size={14} />
              {editMutation.isPending ? 'Starting…' : 'Send'}
            </button>
          </div>

          {/* edit request list */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
              Edit requests
            </div>
            {edits.length === 0 ? (
              <p className="text-[11px] text-[var(--theme-muted)]">
                No edits yet. Describe a change above to get started.
              </p>
            ) : (
              edits.map((e) => <EditRow key={e.taskId} edit={e} brandQ={brandQ} />)
            )}
          </div>
        </div>

        {/* RIGHT: preview + action bar */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--theme-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--theme-border)] px-4 py-2.5">
            <span className="truncate font-mono text-[11px] text-[var(--theme-muted)]">{siteUrl}</span>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reload preview"
              className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
            >
              <HugeiconsIcon icon={RefreshIcon} size={12} />
              Reload
            </button>
          </div>

          <div className="border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-1.5 text-[10px] text-[var(--theme-muted)]">
            The preview shows the LAST DEPLOYED version of {siteName}. Build to compile pending edits;
            deploy to publish them.
          </div>

          {/* preview iframe */}
          <div className="relative min-h-0 flex-1">
            {siteUrl ? (
              <iframe
                key={iframeKey}
                src={siteUrl}
                title={`${siteName} preview`}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[var(--theme-muted)]">
                Preview unavailable
              </div>
            )}
          </div>

          {/* build output drawer */}
          {buildOutput && (
            <div className="max-h-40 shrink-0 overflow-y-auto border-t border-[var(--theme-border)] bg-[#0d1117] p-3">
              <div
                className="mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: buildOutput.ok ? '#10b981' : '#ef4444' }}
              >
                {buildOutput.ok ? 'Success' : 'Failed'}
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[#c9d1d9]">
                {buildOutput.log || '(no output)'}
              </pre>
            </div>
          )}

          {/* action bar */}
          <div className="flex shrink-0 items-center gap-2 border-t border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2.5">
            <button
              onClick={() => buildMutation.mutate()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-40"
            >
              <HugeiconsIcon icon={SourceCodeIcon} size={13} />
              {buildMutation.isPending ? 'Building…' : 'Build'}
            </button>

            <button
              onClick={onRevert}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] disabled:opacity-40"
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={13} />
              {revertMutation.isPending ? 'Reverting…' : 'Revert last change'}
            </button>

            <button
              onClick={onDeploy}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: gradient, boxShadow: glow }}
            >
              <HugeiconsIcon icon={Rocket01Icon} size={13} />
              {deployMutation.isPending ? 'Deploying…' : 'Deploy to Live'}
            </button>
          </div>

          {/* recent changes */}
          {current && current.lastCommits.length > 0 && (
            <div className="max-h-32 shrink-0 overflow-y-auto border-t border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
                Recent changes
              </div>
              <ul className="space-y-0.5">
                {current.lastCommits.slice(0, 8).map((commit) => (
                  <li key={commit.hash} className="flex items-baseline gap-2 text-[11px]">
                    <span className="shrink-0 font-mono text-[var(--theme-muted)]">{commit.hash}</span>
                    <span className="truncate text-[var(--theme-text)]">{commit.subject}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit request row (status + expandable live log) ─────────────────────────────

function EditRow({ edit, brandQ }: { edit: EditRequest; brandQ: string }) {
  const [expanded, setExpanded] = useState(false)

  const taskQuery = useQuery<DevTask | null>({
    queryKey: ['site-studio', 'task', edit.taskId, brandQ],
    queryFn: async () => {
      const res = await fetch(`/api/dev/tasks/${edit.taskId}${brandQ}`)
      if (!res.ok) return null
      const d = (await res.json()) as { task?: DevTask }
      return d.task ?? null
    },
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'queued' || s === 'running' ? 3000 : false
    },
  })
  const task = taskQuery.data
  const taskStatus: DevTaskStatus = task?.status ?? 'queued'
  const color = STATUS_COLOR[taskStatus]
  const active = taskStatus === 'queued' || taskStatus === 'running'

  return (
    <div className="mb-1.5 rounded-lg border border-[var(--theme-border)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
      >
        <span
          className={cn('mt-1 inline-block h-2 w-2 shrink-0 rounded-full', active && 'animate-pulse')}
          style={{ background: color }}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12px] text-[var(--theme-text)]">{edit.prompt}</span>
          <span className="mt-0.5 block text-[10px] font-medium" style={{ color }}>
            {STATUS_LABEL[taskStatus]}
          </span>
        </span>
        <span className="mt-0.5 text-[10px] text-[var(--theme-muted)]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && <EditLog taskId={edit.taskId} brandQ={brandQ} active={active} />}
    </div>
  )
}

function EditLog({ taskId, brandQ, active }: { taskId: string; brandQ: string; active: boolean }) {
  const [log, setLog] = useState('')
  const offsetRef = useRef(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLog('')
    offsetRef.current = 0
  }, [taskId])

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev/tasks/${taskId}/log${brandQ}&offset=${offsetRef.current}`)
      if (!res.ok) return
      const d = (await res.json()) as { content: string; size: number }
      if (d.content) setLog((prev) => prev + d.content)
      offsetRef.current = d.size
    } catch {
      // transient poll failure — retry next tick
    }
  }, [taskId, brandQ])

  useEffect(() => {
    void fetchLog()
    if (!active) return
    const t = setInterval(() => void fetchLog(), 2500)
    return () => clearInterval(t)
  }, [fetchLog, active])

  useEffect(() => {
    if (!active) void fetchLog()
  }, [active, fetchLog])

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [log])

  return (
    <div ref={boxRef} className="max-h-48 overflow-y-auto rounded-b-lg bg-[#0d1117] p-2">
      <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[#c9d1d9]">
        {log || (active ? 'Waiting for output…' : 'No output captured.')}
      </pre>
    </div>
  )
}
