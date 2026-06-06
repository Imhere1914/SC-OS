import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(homedir(), '.ai-os')
const FILE = join(DATA_DIR, 'automations.json')

// ─── Trigger events ─────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'new_contact'
  | 'contact_stage_changed'
  | 'new_conversation'
  | 'new_appointment'
  | 'campaign_sent'
  | 'form_submitted'

export const TRIGGER_EVENTS: TriggerEvent[] = [
  'new_contact',
  'contact_stage_changed',
  'new_conversation',
  'new_appointment',
  'campaign_sent',
  'form_submitted',
]

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  new_contact: 'New contact added',
  contact_stage_changed: 'Contact stage changed',
  new_conversation: 'New conversation started',
  new_appointment: 'New appointment booked',
  campaign_sent: 'Campaign sent',
  form_submitted: 'Form submitted',
}

export const TRIGGER_EMOJIS: Record<TriggerEvent, string> = {
  new_contact: '✨',
  contact_stage_changed: '🔄',
  new_conversation: '💬',
  new_appointment: '📅',
  campaign_sent: '📤',
  form_submitted: '📋',
}

// ─── Conditions ─────────────────────────────────────────────────────────────

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'

export const CONDITION_OPERATORS: ConditionOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty',
]

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

export interface Condition {
  field: string       // e.g. 'stage', 'source', 'tags', 'email'
  operator: ConditionOperator
  value: string       // unused for is_empty / is_not_empty
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type ActionType =
  | 'send_email'
  | 'update_stage'
  | 'add_tag'
  | 'create_task'
  | 'send_notification'
  | 'webhook'

export const ACTION_TYPES: ActionType[] = [
  'send_email', 'update_stage', 'add_tag', 'create_task', 'send_notification', 'webhook',
]

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

export interface ActionConfig {
  type: ActionType
  // send_email
  to?: 'contact' | string          // 'contact' = use contact.email
  subject?: string
  body?: string
  // update_stage
  stage?: string
  // add_tag
  tag?: string
  // create_task
  task_title?: string
  task_priority?: 'high' | 'medium' | 'low'
  // send_notification
  message?: string
  // webhook
  url?: string
  method?: 'POST' | 'GET'
}

// ─── Automation record ───────────────────────────────────────────────────────

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

// ─── Run log ─────────────────────────────────────────────────────────────────

const LOG_FILE = join(DATA_DIR, 'automation-runs.json')

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

// ─── Persistence ─────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString() }

function readAll(): AutomationRecord[] {
  if (!existsSync(FILE)) return []
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as AutomationRecord[] }
  catch { return [] }
}

function writeAll(records: AutomationRecord[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(records, null, 2))
  renameSync(tmp, FILE)
}

export function readRuns(): AutomationRun[] {
  if (!existsSync(LOG_FILE)) return []
  try { return JSON.parse(readFileSync(LOG_FILE, 'utf8')) as AutomationRun[] }
  catch { return [] }
}

export function appendRun(run: AutomationRun) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const all = readRuns()
  all.unshift(run)           // newest first
  const tmp = `${LOG_FILE}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(all.slice(0, 200), null, 2))   // keep last 200
  renameSync(tmp, LOG_FILE)
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function listAutomations(filters: { brand?: string | null; enabled?: boolean } = {}): AutomationRecord[] {
  const brand = filters.brand ?? process.env.BRAND ?? null
  return readAll()
    .filter(a => !brand || brand === 'default' ? true : a.brand === brand)
    .filter(a => filters.enabled == null ? true : a.enabled === filters.enabled)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getAutomation(id: string): AutomationRecord | undefined {
  return readAll().find(a => a.id === id)
}

export function createAutomation(input: {
  name: string
  description?: string
  trigger: TriggerEvent
  conditions?: Condition[]
  actions?: ActionConfig[]
  brand?: string
}): AutomationRecord {
  const ts = nowISO()
  const rec: AutomationRecord = {
    id: randomUUID(),
    brand: input.brand ?? process.env.BRAND ?? 'default',
    name: input.name,
    description: input.description ?? '',
    enabled: true,
    trigger: input.trigger,
    conditions: input.conditions ?? [],
    actions: input.actions ?? [],
    run_count: 0,
    last_run_at: null,
    created_at: ts,
    updated_at: ts,
  }
  const all = readAll()
  all.push(rec)
  writeAll(all)
  return rec
}

export function updateAutomation(id: string, patch: Partial<Pick<AutomationRecord,
  'name' | 'description' | 'enabled' | 'trigger' | 'conditions' | 'actions'
>>): AutomationRecord | undefined {
  const all = readAll()
  const i = all.findIndex(a => a.id === id)
  if (i === -1) return undefined
  all[i] = { ...all[i], ...patch, updated_at: nowISO() }
  writeAll(all)
  return all[i]
}

export function recordRun(id: string) {
  const all = readAll()
  const i = all.findIndex(a => a.id === id)
  if (i === -1) return
  all[i].run_count += 1
  all[i].last_run_at = nowISO()
  writeAll(all)
}

export function deleteAutomation(id: string): boolean {
  const all = readAll()
  const next = all.filter(a => a.id !== id)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}
