import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown) {
  const p = dbPath(file)
  const tmp = p + '.tmp.' + Date.now()
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

export type AgentRole =
  | 'scheduler'
  | 'outreach'
  | 'bookkeeper'
  | 'content'
  | 'researcher'
  | 'dispatcher'
  | 'intake'
  | 'custom'

export type TaskStatus = 'queued' | 'running' | 'review' | 'done' | 'failed'

export interface AgentDef {
  id: string
  role: AgentRole
  name: string
  description: string
  capabilities: string[]
  avatar_emoji: string
  active: boolean
  created_at: string
}

export interface AgentTask {
  id: string
  agent_id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'low' | 'normal' | 'high' | 'urgent'
  result?: string
  error?: string
  parent_task_id?: string
  created_at: string
  started_at?: string
  completed_at?: string
  metadata?: Record<string, unknown>
}

interface AgentsDb {
  agents: AgentDef[]
  tasks: AgentTask[]
}

function load(): AgentsDb {
  return readJson<AgentsDb>('agents.json', { agents: [], tasks: [] })
}

function save(db: AgentsDb) {
  writeJson('agents.json', db)
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const BRAND = process.env.BRAND ?? 'sc'

const SC_DEFAULTS: Omit<AgentDef, 'id' | 'created_at'>[] = [
  { role: 'scheduler', name: 'Scheduler', description: 'Manages appointments, follow-ups, and calendar optimization', capabilities: ['book_appointment', 'send_reminder', 'reschedule'], avatar_emoji: '📅', active: true },
  { role: 'outreach', name: 'Outreach', description: 'Handles email sequences, SMS follow-ups, and lead nurturing', capabilities: ['send_email', 'send_sms', 'create_sequence'], avatar_emoji: '📨', active: true },
  { role: 'bookkeeper', name: 'Bookkeeper', description: 'Invoicing, expense tracking, and financial reconciliation', capabilities: ['create_invoice', 'categorize_expense', 'generate_report'], avatar_emoji: '📊', active: true },
  { role: 'content', name: 'Content Creator', description: 'Social posts, blog drafts, marketing copy, and media', capabilities: ['write_post', 'generate_image', 'schedule_content'], avatar_emoji: '✍️', active: true },
  { role: 'researcher', name: 'Researcher', description: 'Market analysis, competitor intel, and business insights', capabilities: ['web_search', 'analyze_data', 'summarize'], avatar_emoji: '🔍', active: true },
  { role: 'dispatcher', name: 'Dispatcher', description: 'Job assignment, route optimization, and crew coordination', capabilities: ['assign_job', 'optimize_route', 'notify_crew'], avatar_emoji: '🚛', active: true },
]

const HFM_DEFAULTS: Omit<AgentDef, 'id' | 'created_at'>[] = [
  { role: 'scheduler', name: 'Scheduler', description: 'Manages patient appointments, session reminders, and availability', capabilities: ['book_appointment', 'send_reminder', 'reschedule'], avatar_emoji: '📅', active: true },
  { role: 'intake', name: 'Intake Coordinator', description: 'New patient forms, insurance verification, onboarding', capabilities: ['create_form', 'verify_insurance', 'onboard_patient'], avatar_emoji: '📋', active: true },
  { role: 'content', name: 'Wellness Writer', description: 'Health articles, social content, educational materials', capabilities: ['write_post', 'generate_image', 'schedule_content'], avatar_emoji: '🌿', active: true },
  { role: 'bookkeeper', name: 'Billing', description: 'Patient invoicing, insurance claims, payment tracking', capabilities: ['create_invoice', 'submit_claim', 'track_payment'], avatar_emoji: '💰', active: true },
  { role: 'outreach', name: 'Patient Engagement', description: 'Follow-up messages, wellness check-ins, re-engagement', capabilities: ['send_email', 'send_sms', 'create_sequence'], avatar_emoji: '💌', active: true },
  { role: 'researcher', name: 'Research Assistant', description: 'Clinical references, supplement info, protocol support', capabilities: ['web_search', 'summarize', 'find_reference'], avatar_emoji: '🔬', active: true },
]

function seedIfEmpty(db: AgentsDb): AgentsDb {
  if (db.agents.length > 0) return db
  const defaults = BRAND === 'hfm' ? HFM_DEFAULTS : SC_DEFAULTS
  const now = new Date().toISOString()
  db.agents = defaults.map(d => ({ ...d, id: uid(), created_at: now }))
  save(db)
  return db
}

export function listAgents(): AgentDef[] {
  const db = seedIfEmpty(load())
  return db.agents
}

export function getAgent(id: string): AgentDef | undefined {
  return load().agents.find(a => a.id === id)
}

export function createAgent(input: Omit<AgentDef, 'id' | 'created_at'>): AgentDef {
  const db = load()
  const agent: AgentDef = { ...input, id: uid(), created_at: new Date().toISOString() }
  db.agents.push(agent)
  save(db)
  return agent
}

export function updateAgent(id: string, patch: Partial<AgentDef>): AgentDef | null {
  const db = load()
  const idx = db.agents.findIndex(a => a.id === id)
  if (idx < 0) return null
  db.agents[idx] = { ...db.agents[idx], ...patch, id }
  save(db)
  return db.agents[idx]
}

export function listTasks(filters?: { agent_id?: string; status?: TaskStatus; parent_task_id?: string }): AgentTask[] {
  const db = seedIfEmpty(load())
  let tasks = db.tasks
  if (filters?.agent_id) tasks = tasks.filter(t => t.agent_id === filters.agent_id)
  if (filters?.status) tasks = tasks.filter(t => t.status === filters.status)
  if (filters?.parent_task_id) tasks = tasks.filter(t => t.parent_task_id === filters.parent_task_id)
  return tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getTask(id: string): AgentTask | undefined {
  return load().tasks.find(t => t.id === id)
}

export function createTask(input: Omit<AgentTask, 'id' | 'created_at'>): AgentTask {
  const db = seedIfEmpty(load())
  const task: AgentTask = { ...input, id: uid(), created_at: new Date().toISOString() }
  db.tasks.push(task)
  save(db)
  return task
}

export function updateTask(id: string, patch: Partial<AgentTask>): AgentTask | null {
  const db = load()
  const idx = db.tasks.findIndex(t => t.id === id)
  if (idx < 0) return null
  db.tasks[idx] = { ...db.tasks[idx], ...patch, id }
  save(db)
  return db.tasks[idx]
}

export function deleteTask(id: string): boolean {
  const db = load()
  const before = db.tasks.length
  db.tasks = db.tasks.filter(t => t.id !== id)
  if (db.tasks.length === before) return false
  save(db)
  return true
}

export function getTaskStats(): Record<TaskStatus, number> {
  const db = seedIfEmpty(load())
  const stats: Record<TaskStatus, number> = { queued: 0, running: 0, review: 0, done: 0, failed: 0 }
  for (const t of db.tasks) stats[t.status] = (stats[t.status] ?? 0) + 1
  return stats
}
