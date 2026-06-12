import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Dev Studio task store — coding-agent runs (Claude Code / Codex) spawned by
 * the OS backend. File-backed JSON with atomic tmp+rename writes.
 * Tasks:     dev-tasks-{brand}.json
 * Log files: {DATA_DIR}/dev-logs/{taskId}.log
 */

export type DevAgent = 'claude' | 'codex'
export type DevTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface DevTask {
  id: string
  brand: string
  agent: DevAgent
  prompt: string
  workspace: string          // absolute dir the agent ran in
  status: DevTaskStatus
  exit_code?: number
  pid?: number
  log_file: string           // absolute path to the captured output
  started_at?: string
  finished_at?: string
  duration_ms?: number
  created_at: string
}

export interface CreateDevTaskInput {
  id?: string
  agent: DevAgent
  prompt: string
  workspace: string
}

const MAX_STORED_TASKS = 200

function dataDir(): string {
  return process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
}

export function devLogsDir(): string {
  const dir = join(dataDir(), 'dev-logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function dbPath(brand: string): string {
  return join(dataDir(), `dev-tasks-${brand}.json`)
}

type TasksFile = { tasks: DevTask[] }

function readTasks(brand: string): DevTask[] {
  const filePath = dbPath(brand)
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8').trim()
    if (!raw) return []
    const file = JSON.parse(raw) as TasksFile
    return Array.isArray(file.tasks) ? file.tasks : []
  } catch {
    return []
  }
}

function writeTasks(brand: string, tasks: DevTask[]): void {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = dbPath(brand)
  const tmp = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify({ tasks }, null, 2) + '\n', 'utf-8')
  renameSync(tmp, filePath)
}

// ── API ───────────────────────────────────────────────────────────────────────

export function listDevTasks(brand: string, limit?: number): DevTask[] {
  const tasks = readTasks(brand).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return typeof limit === 'number' && limit > 0 ? tasks.slice(0, limit) : tasks
}

export function getDevTask(brand: string, id: string): DevTask | null {
  return readTasks(brand).find((t) => t.id === id) ?? null
}

export function createDevTask(brand: string, data: CreateDevTaskInput): DevTask {
  const id = data.id ?? randomUUID()
  const task: DevTask = {
    id,
    brand,
    agent: data.agent,
    prompt: data.prompt,
    workspace: data.workspace,
    status: 'queued',
    log_file: join(devLogsDir(), `${id}.log`),
    created_at: new Date().toISOString(),
  }
  let tasks = readTasks(brand)
  tasks.push(task)
  if (tasks.length > MAX_STORED_TASKS) {
    tasks = tasks
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_STORED_TASKS)
  }
  writeTasks(brand, tasks)
  return task
}

export function updateDevTask(brand: string, id: string, patch: Partial<DevTask>): DevTask | null {
  const tasks = readTasks(brand)
  const i = tasks.findIndex((t) => t.id === id)
  if (i === -1) return null
  tasks[i] = { ...tasks[i], ...patch, id: tasks[i].id, brand: tasks[i].brand }
  writeTasks(brand, tasks)
  return tasks[i]
}
