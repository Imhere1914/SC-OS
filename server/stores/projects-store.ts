import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Client projects store (Phase 4e).
 *
 * A lightweight project/engagement tracker linked to CRM contacts — distinct
 * from the developer-oriented Tasks/kanban. For SC this is client work
 * (jobs/engagements); for HFM it's patient programs/care plans.
 *
 * File-backed JSON; swap for Postgres when the platform host is live.
 */

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectPriority = 'high' | 'medium' | 'low'

export type ProjectRecord = {
  id: string
  brand: string
  name: string
  description: string
  /** Linked CRM contact (client / patient) */
  contact_id: string | null
  contact_name: string | null
  status: ProjectStatus
  priority: ProjectPriority
  /** 0-100 */
  progress: number
  due_date: string | null
  owner: string | null
  notes: string
  created_at: string
  updated_at: string
}

type ProjectFile = { projects: ProjectRecord[] }

type CreateProjectInput = Partial<ProjectRecord> & { name: string }
type UpdateProjectInput = Partial<Omit<ProjectRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const PROJECTS_FILE = path.join(CLAUDE_HOME, 'projects.json')

const STATUSES: ProjectStatus[] = [
  'active',
  'on_hold',
  'completed',
  'cancelled',
]
const PRIORITIES: ProjectPriority[] = ['high', 'medium', 'low']

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && STATUSES.includes(v as ProjectStatus)
}
export function isProjectPriority(v: unknown): v is ProjectPriority {
  return typeof v === 'string' && PRIORITIES.includes(v as ProjectPriority)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(
      PROJECTS_FILE,
      JSON.stringify({ projects: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): ProjectFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8').trim()
    if (!raw) return { projects: [] }
    const parsed = JSON.parse(raw) as Partial<ProjectFile>
    return { projects: Array.isArray(parsed.projects) ? parsed.projects : [] }
  } catch {
    return { projects: [] }
  }
}

function writeFile(data: ProjectFile): void {
  ensureFile()
  const tmp = `${PROJECTS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, PROJECTS_FILE)
}

function clampProgress(v: unknown): number {
  const n = typeof v === 'number' ? v : 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalize(
  p: Partial<ProjectRecord> &
    Pick<ProjectRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): ProjectRecord {
  return {
    id: p.id,
    brand: typeof p.brand === 'string' ? p.brand : process.env.BRAND ?? 'default',
    name: p.name,
    description: typeof p.description === 'string' ? p.description : '',
    contact_id: p.contact_id ?? null,
    contact_name: p.contact_name ?? null,
    status: isProjectStatus(p.status) ? p.status : 'active',
    priority: isProjectPriority(p.priority) ? p.priority : 'medium',
    progress: clampProgress(p.progress),
    due_date: p.due_date ?? null,
    owner: p.owner ?? null,
    notes: typeof p.notes === 'string' ? p.notes : '',
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

export function listProjects(filters?: {
  status?: string | null
  brand?: string | null
  contact_id?: string | null
}): ProjectRecord[] {
  let projects = readFile().projects.map(normalize)
  if (filters?.status) projects = projects.filter((p) => p.status === filters.status)
  if (filters?.brand) projects = projects.filter((p) => p.brand === filters.brand)
  if (filters?.contact_id)
    projects = projects.filter((p) => p.contact_id === filters.contact_id)
  // Active first, then by priority, then by due date
  const statusOrder: Record<ProjectStatus, number> = {
    active: 0,
    on_hold: 1,
    completed: 2,
    cancelled: 3,
  }
  const priorityOrder: Record<ProjectPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }
  return projects.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
  )
}

export function getProject(id: string): ProjectRecord | null {
  return readFile().projects.map(normalize).find((p) => p.id === id) ?? null
}

export function createProject(input: CreateProjectInput): ProjectRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const project = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    name: input.name,
    description: input.description,
    contact_id: input.contact_id,
    contact_name: input.contact_name,
    status: input.status,
    priority: input.priority,
    progress: input.progress,
    due_date: input.due_date ?? null,
    owner: input.owner,
    notes: input.notes,
    created_at: now,
    updated_at: now,
  })
  file.projects.push(project)
  writeFile({ projects: file.projects.map(normalize) })
  return project
}

export function updateProject(
  id: string,
  updates: UpdateProjectInput,
): ProjectRecord | null {
  const file = readFile()
  const index = file.projects.findIndex((p) => p.id === id)
  if (index === -1) return null
  const current = normalize(file.projects[index] as ProjectRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.projects[index] = next
  writeFile({ projects: file.projects.map(normalize) })
  return next
}

export function deleteProject(id: string): boolean {
  const file = readFile()
  const next = file.projects.filter((p) => p.id !== id)
  if (next.length === file.projects.length) return false
  writeFile({ projects: next.map((p) => normalize(p as ProjectRecord)) })
  return true
}

export const PROJECT_STATUSES = STATUSES
export const PROJECT_PRIORITIES = PRIORITIES
