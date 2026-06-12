/**
 * Automation Engine — evaluates trigger events against stored automations,
 * checks conditions, and executes actions.
 *
 * Call triggerAutomations(event, context) from any route handler.
 * It is fire-and-forget — callers should `void triggerAutomations(...)`.
 */

import {
  appendRun, listAutomations, recordRun,
  type AutomationRecord, type Condition, type ActionConfig, type TriggerEvent,
} from '../stores/automations-store'
import { getContact, updateContact } from '../stores/contacts-store'
import { isEmailConfigured, sendEmail } from '../stores/email-sender'

// ─── Context types ────────────────────────────────────────────────────────────

/** Data passed alongside a trigger event */
export interface TriggerContext {
  contact_id?: string
  contact_name?: string
  contact_email?: string
  contact_stage?: string
  contact_tags?: string[]
  contact_source?: string
  conversation_id?: string
  appointment_id?: string
  campaign_id?: string
  campaign_name?: string
  /** Freeform extras */
  [key: string]: unknown
}

// ─── Condition evaluation ────────────────────────────────────────────────────

function resolveField(ctx: TriggerContext, field: string): string {
  const map: Record<string, () => string> = {
    stage: () => ctx.contact_stage ?? '',
    source: () => ctx.contact_source ?? '',
    name: () => ctx.contact_name ?? '',
    email: () => ctx.contact_email ?? '',
    tags: () => (ctx.contact_tags ?? []).join(','),
  }
  return (map[field] ?? (() => String(ctx[field] ?? '')))()
}

function evalCondition(cond: Condition, ctx: TriggerContext): boolean {
  const actual = resolveField(ctx, cond.field).toLowerCase()
  const expected = (cond.value ?? '').toLowerCase()
  switch (cond.operator) {
    case 'equals':         return actual === expected
    case 'not_equals':     return actual !== expected
    case 'contains':       return actual.includes(expected)
    case 'not_contains':   return !actual.includes(expected)
    case 'is_empty':       return actual === ''
    case 'is_not_empty':   return actual !== ''
    default:               return true
  }
}

function allConditionsMet(conditions: Condition[], ctx: TriggerContext): boolean {
  return conditions.every(c => evalCondition(c, ctx))
}

// ─── Action executors ────────────────────────────────────────────────────────

async function execAction(action: ActionConfig, ctx: TriggerContext): Promise<{ ok: boolean; note: string }> {
  try {
    switch (action.type) {
      case 'send_email': {
        if (!isEmailConfigured()) return { ok: false, note: 'Email not configured (RESEND_API_KEY missing)' }
        const to = action.to === 'contact' ? ctx.contact_email : action.to
        if (!to) return { ok: false, note: 'No email address resolved' }
        const subject = interpolate(action.subject ?? '(no subject)', ctx)
        const body = interpolate(action.body ?? '', ctx)
        const result = await sendEmail({ to, subject, html: `<p>${body.replace(/\n/g, '<br>')}</p>` })
        return result.ok ? { ok: true, note: `Email sent to ${to}` } : { ok: false, note: result.error ?? 'Send failed' }
      }

      case 'update_stage': {
        if (!ctx.contact_id || !action.stage) return { ok: false, note: 'No contact_id or stage' }
        const updated = updateContact(ctx.contact_id, { stage: action.stage as never })
        return updated ? { ok: true, note: `Stage → ${action.stage}` } : { ok: false, note: 'Contact not found' }
      }

      case 'add_tag': {
        if (!ctx.contact_id || !action.tag) return { ok: false, note: 'No contact_id or tag' }
        const contact = getContact(ctx.contact_id)
        if (!contact) return { ok: false, note: 'Contact not found' }
        const tags = Array.from(new Set([...contact.tags, action.tag]))
        updateContact(ctx.contact_id, { tags })
        return { ok: true, note: `Tag "${action.tag}" added` }
      }

      case 'create_task': {
        // Lazy import to avoid circular deps
        const { createTask } = await import('../stores/project-tasks-store.js')
        const title = interpolate(action.task_title ?? 'Follow up', ctx)
        createTask({
          project_id: 'general',
          brand: process.env.BRAND ?? 'default',
          title,
          priority: action.task_priority ?? 'medium',
        })
        return { ok: true, note: `Task created: "${title}"` }
      }

      case 'send_notification': {
        // Notifications are surfaced via the highlights feed.
        // We store them as a special entry in a notifications log.
        const msg = interpolate(action.message ?? 'Automation triggered', ctx)
        const { appendNotification } = await import('../stores/notifications-store.js')
        appendNotification({ brand: process.env.BRAND ?? 'default', message: msg, context_summary: summarize(ctx) })
        return { ok: true, note: `Notification: "${msg}"` }
      }

      case 'webhook': {
        if (!action.url) return { ok: false, note: 'No URL configured' }
        const res = await fetch(action.url, {
          method: action.method ?? 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: ctx, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(10_000),
        })
        return { ok: res.ok, note: `Webhook ${res.status}` }
      }

      default:
        return { ok: false, note: `Unknown action type: ${(action as { type: string }).type}` }
    }
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple {{field}} interpolation */
function interpolate(template: string, ctx: TriggerContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = ctx[key]
    return val != null ? String(val) : ''
  })
}

function summarize(ctx: TriggerContext): string {
  const parts: string[] = []
  if (ctx.contact_name) parts.push(ctx.contact_name)
  if (ctx.contact_email) parts.push(ctx.contact_email)
  if (ctx.contact_stage) parts.push(`stage: ${ctx.contact_stage}`)
  return parts.join(' · ') || 'No context'
}

// ─── Event-bus bridge ─────────────────────────────────────────────────────────

/**
 * Map EventBus event types to the existing TriggerEvent vocabulary, then fire
 * triggerAutomations so every existing automation still works.
 */
function registerEventBusListeners(): void {
  // Avoid loading event-bus at module level (circular-dep risk); import lazily.
  void import('./event-bus').then(({ eventBus }) => {
    eventBus.on('deal.won', ev => {
      void triggerAutomations('deal_won', {
        contact_name: String(ev.data['contact_name'] ?? ''),
        deal_id: ev.entity_id,
        deal_title: String(ev.data['title'] ?? ''),
        deal_value: ev.data['value'] != null ? Number(ev.data['value']) : undefined,
      })
    })

    eventBus.on('deal.created', ev => {
      void triggerAutomations('deal_created', {
        contact_name: String(ev.data['contact_name'] ?? ''),
        deal_id: ev.entity_id,
        deal_title: String(ev.data['title'] ?? ''),
        deal_value: ev.data['value'] != null ? Number(ev.data['value']) : undefined,
      })
    })

    eventBus.on('deal.stage_changed', ev => {
      void triggerAutomations('deal_stage_changed', {
        contact_name: String(ev.data['contact_name'] ?? ''),
        deal_id: ev.entity_id,
        deal_title: String(ev.data['title'] ?? ''),
        new_stage: String(ev.data['new_stage'] ?? ''),
        previous_stage: String(ev.data['previous_stage'] ?? ''),
      })
    })

    eventBus.on('invoice.paid', ev => {
      void triggerAutomations('invoice_paid', {
        contact_name: String(ev.data['contact_name'] ?? ''),
        contact_email: ev.data['contact_email'] != null ? String(ev.data['contact_email']) : undefined,
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        invoice_number: String(ev.data['invoice_number'] ?? ''),
        invoice_total: ev.data['total'] != null ? Number(ev.data['total']) : undefined,
      })
    })

    eventBus.on('invoice.created', ev => {
      void triggerAutomations('invoice_created', {
        contact_name: String(ev.data['contact_name'] ?? ''),
        contact_email: ev.data['contact_email'] != null ? String(ev.data['contact_email']) : undefined,
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        invoice_number: String(ev.data['invoice_number'] ?? ''),
        invoice_total: ev.data['total'] != null ? Number(ev.data['total']) : undefined,
      })
    })

    eventBus.on('appointment.booked', ev => {
      void triggerAutomations('new_appointment', {
        appointment_id: ev.entity_id,
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        contact_name: String(ev.data['contact_name'] ?? ''),
        appointment_title: String(ev.data['title'] ?? ''),
      })
    })

    eventBus.on('appointment.completed', ev => {
      void triggerAutomations('appointment_completed' as TriggerEvent, {
        appointment_id: ev.entity_id,
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        contact_name: String(ev.data['contact_name'] ?? ''),
        appointment_title: String(ev.data['title'] ?? ''),
      })
    })

    eventBus.on('contact.created', ev => {
      void triggerAutomations('new_contact', {
        contact_id: ev.entity_id,
        contact_name: String(ev.data['name'] ?? ''),
        contact_email: ev.data['email'] != null ? String(ev.data['email']) : undefined,
      })
    })

    eventBus.on('form.submitted', ev => {
      void triggerAutomations('form_submitted', {
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        contact_name: String(ev.data['contact_name'] ?? ''),
        contact_email: ev.data['contact_email'] != null ? String(ev.data['contact_email']) : undefined,
        form_id: ev.entity_id,
        form_name: String(ev.data['form_name'] ?? ''),
      })
    })

    eventBus.on('proposal.signed', ev => {
      void triggerAutomations('proposal_signed' as TriggerEvent, {
        contact_id: ev.data['contact_id'] != null ? String(ev.data['contact_id']) : undefined,
        contact_name: String(ev.data['contact_name'] ?? ''),
        contact_email: ev.data['contact_email'] != null ? String(ev.data['contact_email']) : undefined,
        proposal_id: ev.entity_id,
        proposal_title: String(ev.data['title'] ?? ''),
      })
    })
  })
}

/**
 * Call once at server startup to activate the event-bus → automation bridge.
 */
export function initAutomationEngine(_brand?: string): void {
  registerEventBusListeners()
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function triggerAutomations(event: TriggerEvent, ctx: TriggerContext): Promise<void> {
  const brand = (process.env.BRAND ?? 'default')
  const automations = listAutomations({ brand, enabled: true })
    .filter(a => a.trigger === event)

  for (const auto of automations) {
    await runAutomation(auto, ctx)
  }
}

async function runAutomation(auto: AutomationRecord, ctx: TriggerContext): Promise<void> {
  // Check conditions
  if (!allConditionsMet(auto.conditions, ctx)) return

  let actionsRun = 0
  let actionsFailed = 0

  for (const action of auto.actions) {
    const result = await execAction(action, ctx)
    if (result.ok) actionsRun++
    else actionsFailed++
  }

  recordRun(auto.id)

  appendRun({
    id: Math.random().toString(36).slice(2),
    automation_id: auto.id,
    automation_name: auto.name,
    trigger: auto.trigger,
    status: actionsFailed === 0 ? 'success' : actionsRun === 0 ? 'failed' : 'partial',
    actions_run: actionsRun,
    actions_failed: actionsFailed,
    context_summary: summarize(ctx),
    ran_at: new Date().toISOString(),
  })
}
