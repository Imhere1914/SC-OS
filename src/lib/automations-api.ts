/** Automations API client */

export type TriggerEvent =
  | 'new_contact' | 'contact_stage_changed' | 'new_conversation'
  | 'new_appointment' | 'appointment_completed' | 'campaign_sent' | 'form_submitted'
  | 'deal_created' | 'deal_stage_changed' | 'deal_won' | 'deal_lost'
  | 'invoice_created' | 'invoice_paid' | 'proposal_signed'
  | 'sequence_enrolled' | 'sequence_completed' | 'review_request_sent'
  | 'appointment_cancelled' | 'sms_received'

export type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'

export type ActionType =
  | 'send_email' | 'update_stage' | 'add_tag'
  | 'create_task' | 'send_notification' | 'webhook'

export interface Condition {
  field: string
  operator: ConditionOperator
  value: string
}

export interface ActionConfig {
  type: ActionType
  to?: string
  subject?: string
  body?: string
  stage?: string
  tag?: string
  task_title?: string
  task_priority?: 'high' | 'medium' | 'low'
  message?: string
  url?: string
  method?: 'POST' | 'GET'
}

export interface AutomationRecord {
  id: string
  brand: string
  name: string
  description: string
  enabled: boolean
  trigger: TriggerEvent
  conditions: Condition[]
  actions: ActionConfig[]
  run_count: number
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  new_contact: 'New contact added',
  contact_stage_changed: 'Contact stage changed',
  new_conversation: 'New conversation started',
  new_appointment: 'New appointment booked',
  appointment_completed: 'Appointment completed',
  appointment_cancelled: 'Appointment cancelled',
  campaign_sent: 'Campaign sent',
  form_submitted: 'Form submitted',
  deal_created: 'Deal created',
  deal_stage_changed: 'Deal stage changed',
  deal_won: 'Deal won',
  deal_lost: 'Deal lost',
  invoice_created: 'Invoice created',
  invoice_paid: 'Invoice paid',
  proposal_signed: 'Proposal signed',
  sequence_enrolled: 'Contact enrolled in sequence',
  sequence_completed: 'Sequence completed',
  review_request_sent: 'Review request sent',
  sms_received: 'SMS received',
}

export const TRIGGER_EMOJIS: Record<TriggerEvent, string> = {
  new_contact: '✨',
  contact_stage_changed: '🔄',
  new_conversation: '💬',
  new_appointment: '📅',
  appointment_completed: '✅',
  appointment_cancelled: '❌',
  campaign_sent: '📤',
  form_submitted: '📋',
  deal_created: '💼',
  deal_stage_changed: '📊',
  deal_won: '🏆',
  deal_lost: '😞',
  invoice_created: '🧾',
  invoice_paid: '💰',
  proposal_signed: '✍️',
  sequence_enrolled: '📬',
  sequence_completed: '✅',
  review_request_sent: '⭐',
  sms_received: '📱',
}

export const ACTION_LABELS: Record<ActionType, string> = {
  send_email: 'Send email',
  update_stage: 'Update contact stage',
  add_tag: 'Add tag to contact',
  create_task: 'Create task',
  send_notification: 'Send internal notification',
  webhook: 'Fire webhook',
}

export const ACTION_EMOJIS: Record<ActionType, string> = {
  send_email: '📧',
  update_stage: '🔄',
  add_tag: '🏷️',
  create_task: '✅',
  send_notification: '🔔',
  webhook: '🔗',
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

export const TRIGGER_EVENTS: TriggerEvent[] = [
  'new_contact', 'contact_stage_changed', 'new_conversation',
  'new_appointment', 'appointment_completed', 'appointment_cancelled',
  'campaign_sent', 'form_submitted',
  'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost',
  'invoice_created', 'invoice_paid',
  'proposal_signed',
  'sequence_enrolled', 'sequence_completed',
  'review_request_sent', 'sms_received',
]
export const ACTION_TYPES: ActionType[] = [
  'send_email', 'update_stage', 'add_tag', 'create_task', 'send_notification', 'webhook',
]
export const CONDITION_OPERATORS: ConditionOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty',
]

export type AutomationInput = {
  name: string
  description?: string
  trigger: TriggerEvent
  conditions: Condition[]
  actions: ActionConfig[]
}

export async function fetchAutomations(): Promise<AutomationRecord[]> {
  const res = await fetch('/api/automations')
  if (!res.ok) throw new Error('Failed to load automations')
  return (await res.json()).automations
}

export async function createAutomation(input: AutomationInput): Promise<AutomationRecord> {
  const res = await fetch('/api/automations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Create failed')
  return (await res.json()).automation
}

export async function updateAutomation(id: string, patch: Partial<AutomationInput & { enabled: boolean }>): Promise<AutomationRecord> {
  const res = await fetch(`/api/automations/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Update failed')
  return (await res.json()).automation
}

export async function deleteAutomation(id: string): Promise<void> {
  const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export interface AutomationRun {
  id: string
  automation_id: string
  automation_name: string
  trigger: TriggerEvent
  status: 'success' | 'partial' | 'failed'
  actions_run: number
  actions_failed: number
  context_summary: string
  ran_at: string
}

export async function fetchRuns(automationId?: string): Promise<AutomationRun[]> {
  const qs = automationId ? `?id=${automationId}` : ''
  const res = await fetch(`/api/automations/runs${qs}`)
  if (!res.ok) throw new Error('Failed to load runs')
  return (await res.json()).runs
}
