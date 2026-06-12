/**
 * Orchestrator routes (Sprint 80a) — status, config, runs, proposals,
 * manual trigger, approve/dismiss.
 *
 * Decision note: POST /api/orchestrator/run AWAITS the run and returns the
 * finished OrchestratorRun (runs take a few seconds — simpler for the UI
 * than polling).
 */
import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { runOrchestrator, executeProposal } from '../lib/orchestrator'
import {
  listRuns,
  listProposals,
  getProposal,
  decideProposal,
  getConfig,
  updateConfig,
  type ProposalStatus,
} from '../stores/orchestrator-store'

const PROPOSAL_STATUSES: ProposalStatus[] = ['proposed', 'approved', 'dismissed', 'executed', 'failed']

export function registerOrchestrator(app: Hono) {
  // GET /api/orchestrator/status — config + most recent run + pending count
  app.get('/api/orchestrator/status', (c) => {
    const brand = getBrandId(c)
    const config = getConfig(brand)
    const lastRun = listRuns(brand, 1)[0] ?? null
    const pendingCount = listProposals(brand, { status: 'proposed', limit: 500 }).length
    return c.json({ config, last_run: lastRun, pending_count: pendingCount })
  })

  // PATCH /api/orchestrator/config — update enabled / interval_hours / max_proposals_per_run
  app.patch('/api/orchestrator/config', async (c) => {
    const brand = getBrandId(c)
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    const patch: Parameters<typeof updateConfig>[1] = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.interval_hours === 'number' && body.interval_hours > 0) {
      patch.interval_hours = body.interval_hours
    }
    if (typeof body.max_proposals_per_run === 'number' && body.max_proposals_per_run > 0) {
      patch.max_proposals_per_run = body.max_proposals_per_run
    }
    const config = updateConfig(brand, patch)
    return c.json({ config })
  })

  // GET /api/orchestrator/runs?limit= — run history, newest first
  app.get('/api/orchestrator/runs', (c) => {
    const brand = getBrandId(c)
    const limitRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50
    return c.json({ runs: listRuns(brand, limit) })
  })

  // GET /api/orchestrator/proposals?status=&run_id=&limit= — newest first
  app.get('/api/orchestrator/proposals', (c) => {
    const brand = getBrandId(c)
    const statusRaw = c.req.query('status')
    const status = statusRaw && PROPOSAL_STATUSES.includes(statusRaw as ProposalStatus)
      ? (statusRaw as ProposalStatus)
      : undefined
    const runId = c.req.query('run_id') || undefined
    const limitRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200
    return c.json({ proposals: listProposals(brand, { status, run_id: runId, limit }) })
  })

  // POST /api/orchestrator/run — manual trigger; awaits completion and
  // returns the finished run (documented choice).
  app.post('/api/orchestrator/run', async (c) => {
    const brand = getBrandId(c)
    const run = await runOrchestrator(brand, 'manual')
    return c.json({ run }, run.status === 'failed' ? 500 : 200)
  })

  // POST /api/orchestrator/proposals/:id/approve — approve then execute
  app.post('/api/orchestrator/proposals/:id/approve', async (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const existing = getProposal(brand, id)
    if (!existing) return c.json({ error: 'Proposal not found' }, 404)
    if (existing.status !== 'proposed') {
      return c.json({ error: `Proposal is already ${existing.status}`, proposal: existing }, 409)
    }
    decideProposal(brand, id, 'approved')
    const result = await executeProposal(brand, id)
    const proposal = getProposal(brand, id)
    return c.json({ proposal, execution: result })
  })

  // POST /api/orchestrator/proposals/:id/dismiss
  app.post('/api/orchestrator/proposals/:id/dismiss', (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const existing = getProposal(brand, id)
    if (!existing) return c.json({ error: 'Proposal not found' }, 404)
    if (existing.status !== 'proposed') {
      return c.json({ error: `Proposal is already ${existing.status}`, proposal: existing }, 409)
    }
    const proposal = decideProposal(brand, id, 'dismissed')
    return c.json({ proposal })
  })
}
