import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Loading03Icon,
  PlayIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

// ── Types (Sprint 80b API contract) ───────────────────────────────────────────

export interface OrchestratorConfig {
  enabled: boolean
  interval_hours: number
  max_proposals_per_run: number
  last_run_at?: string
}

export interface OrchestratorRun {
  id: string
  brand: string
  trigger: 'scheduled' | 'manual'
  started_at: string
  finished_at?: string
  status: 'running' | 'completed' | 'failed'
  ai_summary?: string
  proposals_count: number
  error?: string
}

export type ProposalType =
  | 'invoice_reminder'
  | 'deal_follow_up'
  | 'appointment_confirmation'
  | 'general_recommendation'

export type ProposalStatus = 'proposed' | 'approved' | 'dismissed' | 'executed' | 'failed'

export interface ProposedAction {
  id: string
  brand: string
  run_id: string
  type: ProposalType
  title: string
  reasoning: string
  draft_subject?: string
  draft_body?: string
  target_type?: string
  target_id?: string
  target_name?: string
  status: ProposalStatus
  status_note?: string
  created_at: string
  decided_at?: string
  executed_at?: string
}

interface StatusResponse {
  config: OrchestratorConfig
  last_run: OrchestratorRun | null
  pending_count: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function relativeTime(iso?: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_META: Record<ProposalType, { label: string; emoji: string; color: string }> = {
  invoice_reminder: { label: 'Invoice Reminder', emoji: '🧾', color: '#f59e0b' },
  deal_follow_up: { label: 'Deal Follow-up', emoji: '💰', color: '#3b82f6' },
  appointment_confirmation: { label: 'Appointment Confirmation', emoji: '📅', color: '#22c55e' },
  general_recommendation: { label: 'Recommendation', emoji: '💡', color: '#8b5cf6' },
}

type FilterTab = 'pending' | 'done' | 'dismissed' | 'all'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'done', label: 'Approved & Executed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

function matchesTab(p: ProposedAction, tab: FilterTab): boolean {
  switch (tab) {
    case 'pending':
      return p.status === 'proposed'
    case 'done':
      return p.status === 'approved' || p.status === 'executed' || p.status === 'failed'
    case 'dismissed':
      return p.status === 'dismissed'
    case 'all':
      return true
  }
}

// ── Settings popover ─────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [6, 12, 24, 48]
const MAX_PROPOSAL_OPTIONS = [4, 8, 12]

function SettingsPopover({
  config,
  onClose,
}: {
  config: OrchestratorConfig
  onClose: () => void
}) {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(config.enabled)
  const [intervalHours, setIntervalHours] = useState(config.interval_hours)
  const [maxProposals, setMaxProposals] = useState(config.max_proposals_per_run)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orchestrator/config?brand=${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          interval_hours: intervalHours,
          max_proposals_per_run: maxProposals,
        }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      return res.json() as Promise<OrchestratorConfig>
    },
    onSuccess: () => {
      toast('Settings saved')
      void queryClient.invalidateQueries({ queryKey: ['orchestrator'] })
      onClose()
    },
    onError: () => toast('Could not save settings', { type: 'error' }),
  })

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border p-4 shadow-2xl"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <h3 className="mb-3 text-[12px] font-semibold text-[var(--theme-text)]">
        Orchestrator Settings
      </h3>

      {/* Enabled toggle */}
      <button
        onClick={() => setEnabled((v) => !v)}
        className="mb-3 flex w-full items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--theme-hover)]"
      >
        <span className="text-[12px] text-[var(--theme-text)]">Hermes runs automatically</span>
        <span
          className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
          style={{ background: enabled ? 'var(--theme-accent)' : 'var(--theme-border)' }}
        >
          <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
            style={{ transform: enabled ? 'translateX(18px)' : 'translateX(3px)' }}
          />
        </span>
      </button>

      {/* Interval */}
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        Run every
      </label>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {INTERVAL_OPTIONS.map((h) => (
          <button
            key={h}
            onClick={() => setIntervalHours(h)}
            className="rounded-lg border py-1.5 text-[11px] font-medium transition-colors"
            style={
              intervalHours === h
                ? { background: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: 'white' }
                : { borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }
            }
          >
            {h}h
          </button>
        ))}
      </div>

      {/* Max proposals */}
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        Max proposals per run
      </label>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {MAX_PROPOSAL_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setMaxProposals(n)}
            className="rounded-lg border py-1.5 text-[11px] font-medium transition-colors"
            style={
              maxProposals === n
                ? { background: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: 'white' }
                : { borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }
            }
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
        >
          Cancel
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--theme-accent)' }}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: ProposedAction }) {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [draftOpen, setDraftOpen] = useState(false)
  const meta = TYPE_META[proposal.type] ?? TYPE_META.general_recommendation

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['orchestrator'] })

  const approve = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/orchestrator/proposals/${proposal.id}/approve?brand=${brand.id}`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error('Approve failed')
      return res.json() as Promise<ProposedAction>
    },
    onSuccess: (p) => {
      if (p.status === 'failed') {
        toast(p.status_note || 'Execution failed', { type: 'error' })
      } else {
        toast(p.status_note || 'Executed')
      }
      invalidate()
    },
    onError: () => toast('Could not approve proposal', { type: 'error' }),
  })

  const dismiss = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/orchestrator/proposals/${proposal.id}/dismiss?brand=${brand.id}`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error('Dismiss failed')
      return res.json() as Promise<ProposedAction>
    },
    onSuccess: () => {
      toast('Proposal dismissed')
      invalidate()
    },
    onError: () => toast('Could not dismiss proposal', { type: 'error' }),
  })

  const copyDraft = () => {
    const text = [proposal.draft_subject, proposal.draft_body].filter(Boolean).join('\n\n')
    void navigator.clipboard.writeText(text).then(() => toast('Copied'))
  }

  const isDismissed = proposal.status === 'dismissed'

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        opacity: isDismissed ? 0.6 : 1,
      }}
    >
      {/* Top row — type badge + time */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: `${meta.color}18`, color: meta.color }}
        >
          {meta.emoji} {meta.label}
        </span>
        {proposal.target_name && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-[var(--theme-muted)]"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {proposal.target_name}
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--theme-muted)]">
          {relativeTime(proposal.created_at)}
        </span>
      </div>

      <p className="text-[13px] font-bold text-[var(--theme-text)]">{proposal.title}</p>
      <p className="mt-1 text-[11px] italic text-[var(--theme-muted)]">
        Why: {proposal.reasoning}
      </p>

      {/* Draft preview / expand */}
      {proposal.draft_body && (
        <div className="mt-3">
          {!draftOpen ? (
            <button
              onClick={() => setDraftOpen(true)}
              className="w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-[var(--theme-hover)]"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <p
                className="overflow-hidden text-[11px] leading-snug text-[var(--theme-muted)]"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {proposal.draft_body}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--theme-accent)]">
                <HugeiconsIcon icon={ArrowDown01Icon} size={11} /> View draft
              </span>
            </button>
          ) : (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                  Draft
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyDraft}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <HugeiconsIcon icon={Copy01Icon} size={10} /> Copy
                  </button>
                  <button
                    onClick={() => setDraftOpen(false)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} size={10} /> Collapse
                  </button>
                </div>
              </div>
              {proposal.draft_subject && (
                <p className="mb-1.5 font-mono text-[11px] font-semibold text-[var(--theme-text)]">
                  Subject: {proposal.draft_subject}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--theme-text)]">
                {proposal.draft_body}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Status / actions */}
      <div className="mt-3">
        {proposal.status === 'proposed' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending || dismiss.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--theme-accent)' }}
            >
              {approve.isPending ? (
                <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />
              )}
              {approve.isPending ? 'Executing…' : 'Approve & Execute'}
            </button>
            <button
              onClick={() => dismiss.mutate()}
              disabled={approve.isPending || dismiss.isPending}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] disabled:opacity-60"
            >
              {dismiss.isPending ? 'Dismissing…' : 'Dismiss'}
            </button>
          </div>
        )}
        {proposal.status === 'executed' && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#22c55e' }}>
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} />
            {proposal.status_note || 'Executed'}
          </p>
        )}
        {proposal.status === 'approved' && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--theme-accent)]">
            <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
            Approved — executing…
          </p>
        )}
        {proposal.status === 'failed' && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: '#ef444418', color: '#ef4444' }}
            >
              Failed
            </span>
            <span style={{ color: '#ef4444' }}>{proposal.status_note || 'Execution failed'}</span>
          </p>
        )}
        {proposal.status === 'dismissed' && (
          <p className="text-[11px] text-[var(--theme-muted)]">
            Dismissed{proposal.decided_at ? ` ${relativeTime(proposal.decided_at)}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Run history item ─────────────────────────────────────────────────────────

function RunStatusDot({ status }: { status: OrchestratorRun['status'] }) {
  const color = status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#f59e0b'
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status === 'running' && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

function RunItem({ run }: { run: OrchestratorRun }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-[var(--theme-hover)]"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div className="flex items-center gap-2">
        <RunStatusDot status={run.status} />
        <span
          className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
          style={{
            background: run.trigger === 'manual' ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'var(--theme-hover)',
            color: run.trigger === 'manual' ? 'var(--theme-accent)' : 'var(--theme-muted)',
          }}
        >
          {run.trigger}
        </span>
        <span className="text-[10px] text-[var(--theme-muted)]">{relativeTime(run.started_at)}</span>
        <span className="ml-auto text-[10px] font-medium text-[var(--theme-text)]">
          {run.proposals_count} proposal{run.proposals_count !== 1 ? 's' : ''}
        </span>
      </div>
      {open && (run.ai_summary || run.error) && (
        <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--theme-border)' }}>
          {run.ai_summary && (
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--theme-text)]">
              {run.ai_summary}
            </p>
          )}
          {run.error && (
            <p className="mt-1 text-[11px]" style={{ color: '#ef4444' }}>
              Error: {run.error}
            </p>
          )}
        </div>
      )}
    </button>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function OrchestratorScreen() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<FilterTab>('pending')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const statusQuery = useQuery<StatusResponse>({
    queryKey: ['orchestrator', 'status', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/orchestrator/status?brand=${brand.id}`)
      if (!res.ok) throw new Error('Status fetch failed')
      return res.json() as Promise<StatusResponse>
    },
    refetchInterval: 15_000,
  })

  const proposalsQuery = useQuery<{ proposals: ProposedAction[] }>({
    queryKey: ['orchestrator', 'proposals', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/orchestrator/proposals?brand=${brand.id}`)
      if (!res.ok) throw new Error('Proposals fetch failed')
      return res.json() as Promise<{ proposals: ProposedAction[] }>
    },
    refetchInterval: 15_000,
  })

  const runsQuery = useQuery<{ runs: OrchestratorRun[] }>({
    queryKey: ['orchestrator', 'runs', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/orchestrator/runs?brand=${brand.id}&limit=20`)
      if (!res.ok) throw new Error('Runs fetch failed')
      return res.json() as Promise<{ runs: OrchestratorRun[] }>
    },
    refetchInterval: 15_000,
  })

  const runNow = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orchestrator/run?brand=${brand.id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Run failed')
      return res.json() as Promise<OrchestratorRun>
    },
    onSuccess: (run) => {
      toast(`Run complete — ${run.proposals_count} proposal${run.proposals_count !== 1 ? 's' : ''}`)
      void queryClient.invalidateQueries({ queryKey: ['orchestrator'] })
    },
    onError: () => toast('Run failed — check run history', { type: 'error' }),
  })

  const config = statusQuery.data?.config
  const proposals = proposalsQuery.data?.proposals ?? []
  const filtered = proposals.filter((p) => matchesTab(p, tab))
  const runs = runsQuery.data?.runs ?? []
  const latestRun = runs[0]

  const countFor = (t: FilterTab) => proposals.filter((p) => matchesTab(p, t)).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={AiMagicIcon} size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">
                Hermes Ops
              </h1>
              <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">
                {config
                  ? `Autonomous mode: ${config.enabled ? 'ON' : 'OFF'}${
                      config.enabled ? ` — runs every ${config.interval_hours}h` : ''
                    } · Last run ${relativeTime(config.last_run_at ?? statusQuery.data?.last_run?.started_at)}`
                  : statusQuery.isError
                    ? 'Orchestrator unavailable'
                    : 'Loading status…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--theme-accent)' }}
            >
              {runNow.isPending ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} size={13} className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={PlayIcon} size={13} />
                  Run Now
                </>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                title="Orchestrator settings"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-xl border transition-colors hover:bg-[var(--theme-hover)]"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <HugeiconsIcon icon={Settings02Icon} size={14} className="text-[var(--theme-muted)]" />
              </button>
              {settingsOpen && config && (
                <SettingsPopover config={config} onClose={() => setSettingsOpen(false)} />
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left — proposals inbox */}
          <div className="lg:col-span-2">
            {/* Filter tabs */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={
                    tab === t.id
                      ? { background: 'var(--theme-accent)', color: 'white' }
                      : { background: 'var(--theme-hover)', color: 'var(--theme-muted)' }
                  }
                >
                  {t.label}
                  <span className="ml-1.5 opacity-70">{countFor(t.id)}</span>
                </button>
              ))}
            </div>

            {proposalsQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border bg-[var(--theme-card)]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                    opacity: 0.85,
                  }}
                >
                  <HugeiconsIcon icon={AiMagicIcon} size={22} className="text-white" />
                </div>
                {tab === 'pending' ? (
                  <>
                    <p className="text-[13px] font-medium text-[var(--theme-text)]">
                      No pending proposals
                    </p>
                    <p className="max-w-xs text-[11px] text-[var(--theme-muted)]">
                      Hermes has nothing queued. Run now or wait for the next cycle.
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-[var(--theme-muted)]">
                    No proposals here yet.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((p) => (
                  <ProposalCard key={p.id} proposal={p} />
                ))}
              </div>
            )}
          </div>

          {/* Right — run history */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
              Run History
            </h2>

            {/* Latest report */}
            {latestRun?.ai_summary && (
              <div
                className="mb-3 rounded-xl border p-3.5"
                style={{
                  background: 'color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card))',
                  borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, var(--theme-border))',
                }}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <HugeiconsIcon icon={AiMagicIcon} size={12} className="text-[var(--theme-accent)]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-accent)]">
                    Latest report
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--theme-muted)]">
                    {relativeTime(latestRun.started_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--theme-text)]">
                  {latestRun.ai_summary}
                </p>
              </div>
            )}

            {runsQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg border bg-[var(--theme-card)]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div
                className="rounded-xl border p-4 text-center"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                <p className="text-[11px] text-[var(--theme-muted)]">
                  No runs yet — hit "Run Now" to kick off the first cycle.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <RunItem key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
