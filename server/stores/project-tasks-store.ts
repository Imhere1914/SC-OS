/**
 * Project tasks store — tasks/subtasks within a project.
 * Stored in ~/.ai-os/project-tasks.json keyed by project_id.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(homedir(), '.ai-os')
const FILE = join(DATA_DIR, 'project-tasks.json')

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export interface ProjectTask {
  id: string
  project_id: string
  brand: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string | null
  due_date: string | null
  subtasks: Subtask[]
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

function nowISO() { return new Date().toISOString() }

function readAll(): ProjectTask[] {
  if (!existsSync(FILE)) return []
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as ProjectTask[] }
  catch { return [] }
}

function writeAll(tasks: ProjectTask[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(tasks, null, 2))
  renameSync(tmp, FILE)
}

export function isTaskStatus(v: unknown): v is TaskStatus {
  return TASK_STATUSES.includes(v as TaskStatus)
}

export function listTasksForProject(projectId: string): ProjectTask[] {
  return readAll()
    .filter(t => t.project_id === projectId)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
}

export function getTask(id: string): ProjectTask | undefined {
  return readAll().find(t => t.id === id)
}

export function createTask(input: {
  project_id: string
  brand: string
  title: string
  description?: string
  priority?: TaskPriority
  assignee?: string | null
  due_date?: string | null
}): ProjectTask {
  const ts = nowISO()
  const task: ProjectTask = {
    id: randomUUID(),
    project_id: input.project_id,
    brand: input.brand,
    title: input.title,
    description: input.description ?? '',
    status: 'todo',
    priority: input.priority ?? 'medium',
    assignee: input.assignee ?? null,
    due_date: input.due_date ?? null,
    subtasks: [],
    created_at: ts,
    updated_at: ts,
  }
  const all = readAll()
  all.push(task)
  writeAll(all)
  return task
}

export function updateTask(id: string, patch: Partial<Pick<ProjectTask, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'due_date' | 'subtasks'>>): ProjectTask | undefined {
  const all = readAll()
  const i = all.findIndex(t => t.id === id)
  if (i === -1) return undefined
  all[i] = { ...all[i], ...patch, updated_at: nowISO() }
  writeAll(all)
  return all[i]
}

export function addSubtask(taskId: string, title: string): ProjectTask | undefined {
  const all = readAll()
  const i = all.findIndex(t => t.id === taskId)
  if (i === -1) return undefined
  all[i].subtasks.push({ id: randomUUID(), title, done: false })
  all[i].updated_at = nowISO()
  writeAll(all)
  return all[i]
}

export function toggleSubtask(taskId: string, subtaskId: string): ProjectTask | undefined {
  const all = readAll()
  const i = all.findIndex(t => t.id === taskId)
  if (i === -1) return undefined
  const sub = all[i].subtasks.find(s => s.id === subtaskId)
  if (sub) sub.done = !sub.done
  all[i].updated_at = nowISO()
  writeAll(all)
  return all[i]
}

export function deleteTask(id: string): boolean {
  const all = readAll()
  const next = all.filter(t => t.id !== id)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}

/** Derive a project progress % from its tasks */
export function computeProjectProgress(projectId: string): number {
  const tasks = listTasksForProject(projectId)
  if (!tasks.length) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}
