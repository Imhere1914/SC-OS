/**
 * Hermes Orchestrator (Sprint 80a) — autonomous, propose-first agent loop.
 *
 * On a schedule (and on demand), pulls the live business state, asks the
 * model (via OpenRouter) to propose bounded actions with drafted content,
 * stores them for human approval, reports a summary into #hermes-ops, and
 * appends an audit entry. Nothing is executed without human approval.
 *
 * Decision notes (documented per spec):
 * - When config.enabled === false and trigger === 'scheduled', runOrchestrator
 *   does NOT create a run record — it returns a synthetic completed run (not
 *   persisted) so run history isn't polluted with skip entries.
 * - Without OPENROUTER_API_KEY the run completes with no ai_summary and zero
 *   proposals (graceful degradation).
 */
import { buildBusinessContext } from './business-context'
import {
  createRun,
  finishRun,
  createProposal,
  getConfig,
  updateConfig,
  getProposal,
  markExecuted,
  type OrchestratorRun,
  type ProposalType,
  type ProposedAction,
} from '../stores/orchestrator-store'
import { listInvoices, type InvoiceRecord } from '../stores/invoices-store'
import { listDeals, type DealRecord } from '../stores/deals-store'
import { listAppointments, type AppointmentRecord } from '../stores/appointments-store'
import { listContacts, getContact } from '../stores/contacts-store'
import { listChannels, createChannel, postMessage } from '../stores/team-chat-store'
import { appendAudit } from '../stores/audit-store'
import { isEmailConfigured, sendEmail, renderTransactionalHtml } from '../stores/email-sender'

const ALLOWED_TYPES: ProposalType[] = [
  'invoice_reminder',
  'deal_follow_up',
  'appointment_confirmation',
  'general_recommendation',
]

const TARGET_TYPES = ['invoice', 'deal', 'appointment', 'contact'] as const

function brandName(brand: string): string {
  return brand === 'hfm' ? 'Holistic Functional Care'
    : brand === 'sc' ? 'Simple Connect'
    : 'AI OS'
}

// ── State gathering ───────────────────────────────────────────────────────────

interface GatheredState {
  overdueInvoices: Array<{
    id: string
    invoice_number: string
    contact_name: string
    contact_id?: string
    total: number
    days_overdue: number
  }>
  coldDeals: Array<{
    id: string
    title: string
    stage: string
    value_usd: number
    contact_name?: string
    contact_id?: string
    days_stale: number
  }>
  upcomingAppointments: Array<{
    id: string
    title: string
    contact_name: string | null
    contact_id: string | null
    starts_at: string
    status: string
  }>
  newContactsThisWeek: number
  businessContext: string
}

function gatherState(brand: string): GatheredState {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  let overdueInvoices: GatheredState['overdueInvoices'] = []
  try {
    overdueInvoices = listInvoices(brand)
      .filter((i: InvoiceRecord) => i.status === 'sent' && !!i.due_date && i.due_date < today)
      .map((i: InvoiceRecord) => ({
        id: i.id,
        invoice_number: i.invoice_number,
        contact_name: i.contact_name,
        contact_id: i.contact_id,
        total: i.total,
        days_overdue: Math.floor((now - new Date(i.due_date as string).getTime()) / 86_400_000),
      }))
  } catch { overdueInvoices = [] }

  let coldDeals: GatheredState['coldDeals'] = []
  try {
    const cutoff = now - 14 * 86_400_000
    coldDeals = listDeals(brand)
      .filter((d: DealRecord) =>
        !['won', 'lost'].includes(d.stage) && new Date(d.updated_at).getTime() < cutoff)
      .map((d: DealRecord) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value_usd: Math.round(d.value / 100), // value stored in USD cents
        contact_name: d.contact_name,
        contact_id: d.contact_id,
        days_stale: Math.floor((now - new Date(d.updated_at).getTime()) / 86_400_000),
      }))
  } catch { coldDeals = [] }

  let upcomingAppointments: GatheredState['upcomingAppointments'] = []
  try {
    const endOfTomorrow = new Date(now + 2 * 86_400_000).toISOString().slice(0, 10)
    upcomingAppointments = listAppointments({ brand })
      .filter((a: AppointmentRecord) => {
        const day = a.starts_at.slice(0, 10)
        return day >= today && day < endOfTomorrow &&
          !['cancelled', 'completed', 'no_show'].includes(a.status)
      })
      .map((a: AppointmentRecord) => ({
        id: a.id,
        title: a.title,
        contact_name: a.contact_name,
        contact_id: a.contact_id,
        starts_at: a.starts_at,
        status: a.status,
      }))
  } catch { upcomingAppointments = [] }

  let newContactsThisWeek = 0
  try {
    const weekAgo = new Date(now - 7 * 86_400_000).toISOString()
    newContactsThisWeek = listContacts({}).filter(c => c.created_at >= weekAgo).length
  } catch { newContactsThisWeek = 0 }

  let businessContext = ''
  try {
    businessContext = buildBusinessContext(brand)
  } catch { businessContext = '' }

  return { overdueInvoices, coldDeals, upcomingAppointments, newContactsThisWeek, businessContext }
}

function formatStateForModel(state: GatheredState): string {
  const lines: string[] = []

  lines.push('## Overdue invoices (status sent, past due date)')
  if (state.overdueInvoices.length === 0) lines.push('None.')
  for (const inv of state.overdueInvoices) {
    lines.push(
      `- ${inv.invoice_number} | contact: ${inv.contact_name} | amount: $${inv.total.toFixed(2)} | ${inv.days_overdue}d overdue | target_type: invoice | target_id: ${inv.id}`
    )
  }

  lines.push('', '## Cold deals (open, no update in 14+ days)')
  if (state.coldDeals.length === 0) lines.push('None.')
  for (const d of state.coldDeals) {
    lines.push(
      `- "${d.title}" | stage: ${d.stage} | value: $${d.value_usd} | contact: ${d.contact_name ?? 'unknown'} | ${d.days_stale}d stale | target_type: deal | target_id: ${d.id}`
    )
  }

  lines.push('', '## Appointments today and tomorrow')
  if (state.upcomingAppointments.length === 0) lines.push('None.')
  for (const a of state.upcomingAppointments) {
    lines.push(
      `- "${a.title}" | contact: ${a.contact_name ?? 'unknown'} | time: ${a.starts_at} | status: ${a.status} | target_type: appointment | target_id: ${a.id}`
    )
  }

  lines.push('', `## New contacts this week: ${state.newContactsThisWeek}`)
  if (state.businessContext) {
    lines.push('', '## Business snapshot', state.businessContext)
  }
  return lines.join('\n')
}

// ── Planning (OpenRouter call) ────────────────────────────────────────────────

interface PlannedProposal {
  type: ProposalType
  title: string
  reasoning: string
  draft_subject?: string
  draft_body?: string
  target_type?: ProposedAction['target_type']
  target_id?: string
  target_name?: string
}

interface Plan {
  summary: string | null
  proposals: PlannedProposal[]
}

function parsePlan(raw: string, maxProposals: number): Plan {
  // Strip markdown fences if present
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) text = fence[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Last resort: find the outermost JSON object
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) return { summary: null, proposals: [] }
    try { parsed = JSON.parse(text.slice(start, end + 1)) } catch { return { summary: null, proposals: [] } }
  }

  if (typeof parsed !== 'object' || parsed === null) return { summary: null, proposals: [] }
  const obj = parsed as Record<string, unknown>
  const summary = typeof obj.summary === 'string' ? obj.summary : null
  const rawProposals = Array.isArray(obj.proposals) ? obj.proposals : []

  const proposals: PlannedProposal[] = []
  for (const p of rawProposals) {
    if (proposals.length >= maxProposals) break
    if (typeof p !== 'object' || p === null) continue
    const rec = p as Record<string, unknown>
    if (typeof rec.type !== 'string' || !ALLOWED_TYPES.includes(rec.type as ProposalType)) continue
    if (typeof rec.title !== 'string' || !rec.title.trim()) continue
    const targetType =
      typeof rec.target_type === 'string' &&
      (TARGET_TYPES as readonly string[]).includes(rec.target_type)
        ? (rec.target_type as ProposedAction['target_type'])
        : undefined
    proposals.push({
      type: rec.type as ProposalType,
      title: rec.title.trim(),
      reasoning: typeof rec.reasoning === 'string' ? rec.reasoning : '',
      draft_subject: typeof rec.draft_subject === 'string' && rec.draft_subject.trim() ? rec.draft_subject : undefined,
      draft_body: typeof rec.draft_body === 'string' && rec.draft_body.trim() ? rec.draft_body : undefined,
      target_type: targetType,
      target_id: typeof rec.target_id === 'string' && rec.target_id.trim() ? rec.target_id : undefined,
      target_name: typeof rec.target_name === 'string' && rec.target_name.trim() ? rec.target_name : undefined,
    })
  }
  return { summary, proposals }
}

async function askHermesToPlan(
  brand: string,
  state: GatheredState,
  maxProposals: number,
): Promise<Plan | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  const model = process.env.MODEL ?? 'minimax/minimax-m3'

  const hfmRule = brand === 'hfm'
    ? ' NEVER diagnose conditions or give medical advice in any drafted content.'
    : ''

  const systemPrompt =
    `You are Hermes, the autonomous operations agent for ${brandName(brand)}. ` +
    `Review the business state and propose concrete actions. You may ONLY propose actions of these types: ` +
    `invoice_reminder, deal_follow_up, appointment_confirmation, general_recommendation. ` +
    `For each, write the reasoning and (for the first three types) draft the actual message ready to send. ` +
    `Be selective — only propose actions that genuinely matter. Maximum ${maxProposals}.${hfmRule}\n\n` +
    `Respond ONLY with JSON: {"summary": "...", "proposals": [{"type": "...", "title": "...", "reasoning": "...", ` +
    `"draft_subject": "...", "draft_body": "...", "target_type": "...", "target_id": "...", "target_name": "..."}]}\n` +
    `target_type must be one of: invoice, deal, appointment, contact. Use the exact target_id values given in the data.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai-os.app',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: formatStateForModel(state) },
        ],
        max_tokens: 2500,
        temperature: 0.4,
      }),
    })
    if (!res.ok) return { summary: null, proposals: [] }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) return { summary: null, proposals: [] }
    return parsePlan(content, maxProposals)
  } catch {
    return { summary: null, proposals: [] }
  }
}

// ── Team chat reporting ───────────────────────────────────────────────────────

const HERMES_OPS_CHANNEL = '#hermes-ops'

function reportToTeamChat(brand: string, run: OrchestratorRun, proposals: ProposedAction[]): void {
  try {
    let channel = listChannels(brand).find(ch => ch.name === HERMES_OPS_CHANNEL)
    if (!channel) {
      channel = createChannel(brand, {
        name: HERMES_OPS_CHANNEL,
        description: 'Hermes orchestrator reports and proposed actions',
      })
    }

    const lines: string[] = []
    lines.push(`Orchestrator run complete (${run.trigger}).`)
    if (run.ai_summary) lines.push('', run.ai_summary)
    if (proposals.length > 0) {
      lines.push('', `Proposed actions (${proposals.length}):`)
      proposals.forEach((p, i) => {
        const target = p.target_name ? ` — ${p.target_name}` : ''
        lines.push(`${i + 1}. ${p.title}${target}`)
      })
      lines.push('', 'Review and approve in the Orchestrator screen (/orchestrator).')
    } else {
      lines.push('', 'No actions proposed this run.')
    }

    postMessage(brand, channel.id, {
      author_id: 'hermes',
      author_name: 'Hermes',
      body: lines.join('\n'),
      is_ai: true,
    })
  } catch (err) {
    console.error('[orchestrator] team chat report failed:', err)
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runOrchestrator(
  brand: string,
  trigger: 'scheduled' | 'manual',
): Promise<OrchestratorRun> {
  const config = getConfig(brand)

  // Disabled + scheduled: skip without persisting a run (see header notes).
  if (!config.enabled && trigger === 'scheduled') {
    const now = new Date().toISOString()
    return {
      id: 'skipped',
      brand,
      trigger,
      started_at: now,
      finished_at: now,
      status: 'completed',
      ai_summary: 'Skipped: orchestrator is disabled.',
      proposals_count: 0,
    }
  }

  const run = createRun(brand, trigger)

  try {
    const state = gatherState(brand)
    const plan = await askHermesToPlan(brand, state, config.max_proposals_per_run)

    const created: ProposedAction[] = []
    if (plan) {
      for (const p of plan.proposals) {
        created.push(createProposal(brand, { run_id: run.id, ...p }))
      }
    }

    const finished = finishRun(brand, run.id, {
      status: 'completed',
      ai_summary: plan?.summary ?? undefined,
      proposals_count: created.length,
    }) ?? { ...run, status: 'completed' as const, proposals_count: created.length, ai_summary: plan?.summary ?? undefined }

    reportToTeamChat(brand, finished, created)

    try {
      appendAudit(brand, {
        brand,
        actor: 'hermes',
        action: 'orchestrator.run',
        entity_type: 'orchestrator_run',
        entity_id: run.id,
        entity_label: `Orchestrator run (${trigger})`,
        details: {
          trigger,
          proposals_count: created.length,
          overdue_invoices: state.overdueInvoices.length,
          cold_deals: state.coldDeals.length,
          upcoming_appointments: state.upcomingAppointments.length,
          new_contacts_this_week: state.newContactsThisWeek,
          ai_planned: plan !== null,
        },
      })
    } catch (err) {
      console.error('[orchestrator] audit append failed:', err)
    }

    console.log(`[orchestrator] run ${run.id} completed (${created.length} proposals, brand: ${brand})`)
    return finished
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[orchestrator] run failed:', message)
    return finishRun(brand, run.id, { status: 'failed', error: message }) ??
      { ...run, status: 'failed' as const, error: message }
  }
}

// ── Execution layer (post-approval) ──────────────────────────────────────────

export async function executeProposal(
  brand: string,
  proposalId: string,
): Promise<{ ok: boolean; note: string }> {
  try {
    const proposal = getProposal(brand, proposalId)
    if (!proposal) return { ok: false, note: 'Proposal not found' }

    let result: { ok: boolean; note: string }

    if (proposal.type === 'general_recommendation') {
      result = { ok: true, note: 'Acknowledged' }
    } else {
      // Email-type actions: invoice_reminder, deal_follow_up, appointment_confirmation
      const email = resolveTargetEmail(brand, proposal)
      if (email && isEmailConfigured()) {
        const subject = proposal.draft_subject ?? proposal.title
        const body = proposal.draft_body ?? proposal.reasoning
        const html = renderTransactionalHtml({
          brandName: brandName(brand),
          heading: subject,
          lines: body.split(/\n+/).filter(l => l.trim()),
        })
        const sent = await sendEmail({ to: email, subject, html })
        result = sent.ok
          ? { ok: true, note: `Email sent to ${email}` }
          : { ok: false, note: `Email send failed: ${sent.error}` }
      } else {
        result = {
          ok: true,
          note: 'Draft ready — email not configured, content available for manual send',
        }
      }
    }

    markExecuted(brand, proposalId, result.ok, result.note)

    try {
      appendAudit(brand, {
        brand,
        actor: 'user',
        action: 'orchestrator.execute',
        entity_type: proposal.target_type ?? 'proposal',
        entity_id: proposal.target_id ?? proposal.id,
        entity_label: proposal.target_name ?? proposal.title,
        details: { proposal_id: proposal.id, type: proposal.type, ok: result.ok, note: result.note },
      })
    } catch (err) {
      console.error('[orchestrator] audit append failed:', err)
    }

    return result
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err)
    try { markExecuted(brand, proposalId, false, note) } catch { /* ignore */ }
    return { ok: false, note }
  }
}

/** Find the best email address for a proposal's target. */
function resolveTargetEmail(brand: string, proposal: ProposedAction): string | null {
  try {
    if (proposal.target_type === 'contact' && proposal.target_id) {
      return getContact(proposal.target_id)?.email ?? null
    }
    if (proposal.target_type === 'invoice' && proposal.target_id) {
      const inv = listInvoices(brand).find(i => i.id === proposal.target_id)
      if (inv?.contact_email) return inv.contact_email
      if (inv?.contact_id) return getContact(inv.contact_id)?.email ?? null
      return null
    }
    if (proposal.target_type === 'deal' && proposal.target_id) {
      const deal = listDeals(brand).find(d => d.id === proposal.target_id)
      if (deal?.contact_id) return getContact(deal.contact_id)?.email ?? null
      return null
    }
    if (proposal.target_type === 'appointment' && proposal.target_id) {
      const appt = listAppointments({ brand }).find(a => a.id === proposal.target_id)
      if (appt?.contact_id) return getContact(appt.contact_id)?.email ?? null
      return null
    }
    return null
  } catch {
    return null
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 30 * 60_000 // check every 30 minutes

let _started = false

export function startOrchestratorScheduler(): void {
  if (_started) return
  _started = true
  const brand = process.env.BRAND ?? 'default'

  const check = () => {
    try {
      const config = getConfig(brand)
      if (!config.enabled) return
      const now = Date.now()
      const due =
        !config.last_run_at ||
        now - new Date(config.last_run_at).getTime() >= config.interval_hours * 3_600_000
      if (!due) return
      // Mark last_run_at FIRST to prevent double-fire
      updateConfig(brand, { last_run_at: new Date(now).toISOString() })
      void runOrchestrator(brand, 'scheduled').catch(e =>
        console.error('[orchestrator] scheduled run error:', e))
    } catch (err) {
      console.error('[orchestrator] scheduler check error:', err)
    }
  }

  setInterval(check, CHECK_INTERVAL_MS)
  console.log('[ai-os] Orchestrator scheduler started (30 min check interval)')
}
