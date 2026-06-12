/**
 * Orchestrator store — runs, proposed actions, and config for the Hermes
 * autonomous orchestrator (Sprint 80a).
 *
 * Files:
 *   orchestrator-runs-{brand}.json       (capped at 100, newest first)
 *   orchestrator-proposals-{brand}.json  (capped at 500, newest first)
 *   orchestrator-config-{brand}.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown) {
  const tmp = dbPath(file) + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(file))
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  title: string                 // "Send reminder for Invoice INV-014"
  reasoning: string             // why Hermes proposes this
  draft_subject?: string        // for email-type actions
  draft_body?: string           // the drafted message content
  target_type?: 'invoice' | 'deal' | 'appointment' | 'contact'
  target_id?: string
  target_name?: string          // contact/deal name for display
  status: ProposalStatus
  status_note?: string          // execution result or failure reason
  created_at: string
  decided_at?: string
  executed_at?: string
}

export interface OrchestratorRun {
  id: string
  brand: string
  trigger: 'scheduled' | 'manual'
  started_at: string
  finished_at?: string
  status: 'running' | 'completed' | 'failed'
  ai_summary?: string           // Hermes's own summary of what it saw and proposed
  proposals_count: number
  error?: string
}

export interface OrchestratorConfig {
  enabled: boolean              // default true
  interval_hours: number        // default 24
  max_proposals_per_run: number // default 8
  last_run_at?: string
}

const MAX_RUNS = 100
const MAX_PROPOSALS = 500

const DEFAULT_CONFIG: OrchestratorConfig = {
  enabled: true,
  interval_hours: 24,
  max_proposals_per_run: 8,
}

function runsFile(brand: string) { return `orchestrator-runs-${brand}.json` }
function proposalsFile(brand: string) { return `orchestrator-proposals-${brand}.json` }
function configFile(brand: string) { return `orchestrator-config-${brand}.json` }

// ── Runs ──────────────────────────────────────────────────────────────────────

export function listRuns(brand: string, limit?: number): OrchestratorRun[] {
  const runs = readJson<OrchestratorRun[]>(runsFile(brand), [])
  runs.sort((a, b) => b.started_at.localeCompare(a.started_at))
  return runs.slice(0, limit ?? 50)
}

export function getRun(brand: string, id: string): OrchestratorRun | null {
  return readJson<OrchestratorRun[]>(runsFile(brand), []).find(r => r.id === id) ?? null
}

export function createRun(brand: string, trigger: 'scheduled' | 'manual'): OrchestratorRun {
  const runs = readJson<OrchestratorRun[]>(runsFile(brand), [])
  const run: OrchestratorRun = {
    id: randomUUID(),
    brand,
    trigger,
    started_at: new Date().toISOString(),
    status: 'running',
    proposals_count: 0,
  }
  const updated = [run, ...runs].slice(0, MAX_RUNS)
  writeJson(runsFile(brand), updated)
  return run
}

export function finishRun(
  brand: string,
  id: string,
  patch: Partial<Pick<OrchestratorRun, 'status' | 'ai_summary' | 'proposals_count' | 'error'>>,
): OrchestratorRun | null {
  const runs = readJson<OrchestratorRun[]>(runsFile(brand), [])
  const i = runs.findIndex(r => r.id === id)
  if (i === -1) return null
  runs[i] = {
    ...runs[i],
    ...patch,
    finished_at: new Date().toISOString(),
  }
  writeJson(runsFile(brand), runs)
  return runs[i]
}

// ── Proposals ─────────────────────────────────────────────────────────────────

export function listProposals(
  brand: string,
  opts?: { status?: ProposalStatus; run_id?: string; limit?: number },
): ProposedAction[] {
  let proposals = readJson<ProposedAction[]>(proposalsFile(brand), [])
  if (opts?.status) proposals = proposals.filter(p => p.status === opts.status)
  if (opts?.run_id) proposals = proposals.filter(p => p.run_id === opts.run_id)
  proposals.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return proposals.slice(0, opts?.limit ?? 200)
}

export function getProposal(brand: string, id: string): ProposedAction | null {
  return readJson<ProposedAction[]>(proposalsFile(brand), []).find(p => p.id === id) ?? null
}

export function createProposal(
  brand: string,
  data: Omit<ProposedAction, 'id' | 'brand' | 'status' | 'created_at'> &
    Partial<Pick<ProposedAction, 'status'>>,
): ProposedAction {
  const proposals = readJson<ProposedAction[]>(proposalsFile(brand), [])
  const proposal: ProposedAction = {
    ...data,
    id: randomUUID(),
    brand,
    status: data.status ?? 'proposed',
    created_at: new Date().toISOString(),
  }
  const updated = [proposal, ...proposals].slice(0, MAX_PROPOSALS)
  writeJson(proposalsFile(brand), updated)
  return proposal
}

export function decideProposal(
  brand: string,
  id: string,
  status: 'approved' | 'dismissed',
): ProposedAction | null {
  const proposals = readJson<ProposedAction[]>(proposalsFile(brand), [])
  const i = proposals.findIndex(p => p.id === id)
  if (i === -1) return null
  proposals[i] = {
    ...proposals[i],
    status,
    decided_at: new Date().toISOString(),
  }
  writeJson(proposalsFile(brand), proposals)
  return proposals[i]
}

export function markExecuted(
  brand: string,
  id: string,
  ok: boolean,
  note?: string,
): ProposedAction | null {
  const proposals = readJson<ProposedAction[]>(proposalsFile(brand), [])
  const i = proposals.findIndex(p => p.id === id)
  if (i === -1) return null
  proposals[i] = {
    ...proposals[i],
    status: ok ? 'executed' : 'failed',
    status_note: note,
    executed_at: new Date().toISOString(),
  }
  writeJson(proposalsFile(brand), proposals)
  return proposals[i]
}

// ── Config ────────────────────────────────────────────────────────────────────

export function getConfig(brand: string): OrchestratorConfig {
  const stored = readJson<Partial<OrchestratorConfig>>(configFile(brand), {})
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_CONFIG.enabled,
    interval_hours:
      typeof stored.interval_hours === 'number' && stored.interval_hours > 0
        ? stored.interval_hours
        : DEFAULT_CONFIG.interval_hours,
    max_proposals_per_run:
      typeof stored.max_proposals_per_run === 'number' && stored.max_proposals_per_run > 0
        ? stored.max_proposals_per_run
        : DEFAULT_CONFIG.max_proposals_per_run,
    last_run_at: typeof stored.last_run_at === 'string' ? stored.last_run_at : undefined,
  }
}

export function updateConfig(
  brand: string,
  patch: Partial<OrchestratorConfig>,
): OrchestratorConfig {
  const current = getConfig(brand)
  const next: OrchestratorConfig = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    interval_hours:
      typeof patch.interval_hours === 'number' && patch.interval_hours > 0
        ? patch.interval_hours
        : current.interval_hours,
    max_proposals_per_run:
      typeof patch.max_proposals_per_run === 'number' && patch.max_proposals_per_run > 0
        ? patch.max_proposals_per_run
        : current.max_proposals_per_run,
    last_run_at: typeof patch.last_run_at === 'string' ? patch.last_run_at : current.last_run_at,
  }
  writeJson(configFile(brand), next)
  return next
}
