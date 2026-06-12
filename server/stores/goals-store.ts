/**
 * Goals & OKRs Store
 * File-backed JSON per brand at AIOS_DATA_DIR/goals-{brand}.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

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

export type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'completed' | 'cancelled'
export type GoalPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'annual' | 'custom'

export interface KeyResult {
  id: string
  title: string
  target_value: number
  current_value: number
  unit: string           // e.g. "$", "%", "users", "leads"
  progress: number       // 0-100 calculated
  status: GoalStatus
  due_date?: string
}

export interface GoalRecord {
  id: string
  brand: string
  title: string          // The Objective
  description?: string
  period: GoalPeriod
  year: number
  custom_start?: string
  custom_end?: string
  owner?: string
  status: GoalStatus
  key_results: KeyResult[]
  overall_progress: number   // avg of key_result progress values
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowISO(): string { return new Date().toISOString() }

function fileName(brand: string): string {
  return `goals-${brand}.json`
}

function readGoals(brand: string): GoalRecord[] {
  return readJson<GoalRecord[]>(fileName(brand), [])
}

function writeGoals(brand: string, goals: GoalRecord[]): void {
  writeJson(fileName(brand), goals)
}

export function calcProgress(goal: GoalRecord): number {
  if (!goal.key_results.length) return 0
  const sum = goal.key_results.reduce((acc, kr) => {
    const p = kr.target_value > 0 ? Math.min(100, (kr.current_value / kr.target_value) * 100) : 0
    return acc + p
  }, 0)
  return Math.round(sum / goal.key_results.length)
}

function calcKrProgress(kr: KeyResult): number {
  return kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listGoals(
  brand: string,
  opts?: { period?: GoalPeriod; year?: number; status?: GoalStatus },
): GoalRecord[] {
  return readGoals(brand).filter(g =>
    (!opts?.period || g.period === opts.period) &&
    (!opts?.year || g.year === opts.year) &&
    (!opts?.status || g.status === opts.status),
  ).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getGoal(brand: string, id: string): GoalRecord | null {
  return readGoals(brand).find(g => g.id === id) ?? null
}

export function createGoal(
  brand: string,
  data: {
    title: string
    description?: string
    period: GoalPeriod
    year: number
    custom_start?: string
    custom_end?: string
    owner?: string
    status?: GoalStatus
    key_results?: Array<{
      title: string
      target_value: number
      current_value?: number
      unit?: string
      status?: GoalStatus
      due_date?: string
    }>
  },
): GoalRecord {
  const ts = nowISO()
  const krs: KeyResult[] = (data.key_results ?? []).map(kr => {
    const current_value = kr.current_value ?? 0
    const target_value = kr.target_value
    const progress = target_value > 0 ? Math.min(100, Math.round((current_value / target_value) * 100)) : 0
    return {
      id: nanoid(),
      title: kr.title,
      target_value,
      current_value,
      unit: kr.unit ?? '',
      progress,
      status: kr.status ?? 'on_track',
      due_date: kr.due_date,
    }
  })

  const goal: GoalRecord = {
    id: nanoid(),
    brand,
    title: data.title,
    description: data.description,
    period: data.period,
    year: data.year,
    custom_start: data.custom_start,
    custom_end: data.custom_end,
    owner: data.owner,
    status: data.status ?? 'on_track',
    key_results: krs,
    overall_progress: 0,
    created_at: ts,
    updated_at: ts,
  }
  goal.overall_progress = calcProgress(goal)

  const goals = readGoals(brand)
  goals.push(goal)
  writeGoals(brand, goals)
  return goal
}

export function updateGoal(
  brand: string,
  id: string,
  patch: Partial<Omit<GoalRecord, 'id' | 'brand' | 'created_at'>>,
): GoalRecord | null {
  const goals = readGoals(brand)
  const idx = goals.findIndex(g => g.id === id)
  if (idx === -1) return null

  goals[idx] = { ...goals[idx], ...patch, updated_at: nowISO() }

  // Recalculate overall_progress when key_results change
  if (patch.key_results !== undefined) {
    goals[idx].overall_progress = calcProgress(goals[idx])
  }

  writeGoals(brand, goals)
  return goals[idx]
}

export function deleteGoal(brand: string, id: string): boolean {
  const goals = readGoals(brand)
  const next = goals.filter(g => g.id !== id)
  if (next.length === goals.length) return false
  writeGoals(brand, next)
  return true
}

export function updateKeyResult(
  brand: string,
  goalId: string,
  krId: string,
  patch: {
    current_value?: number
    target_value?: number
    title?: string
    unit?: string
    status?: GoalStatus
    due_date?: string
  },
): GoalRecord | null {
  const goals = readGoals(brand)
  const goalIdx = goals.findIndex(g => g.id === goalId)
  if (goalIdx === -1) return null

  const krIdx = goals[goalIdx].key_results.findIndex(kr => kr.id === krId)
  if (krIdx === -1) return null

  const existing = goals[goalIdx].key_results[krIdx]
  const updated: KeyResult = {
    ...existing,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
    current_value: patch.current_value !== undefined ? patch.current_value : existing.current_value,
    target_value: patch.target_value !== undefined ? patch.target_value : existing.target_value,
  }
  updated.progress = calcKrProgress(updated)

  goals[goalIdx].key_results[krIdx] = updated
  goals[goalIdx].overall_progress = calcProgress(goals[goalIdx])
  goals[goalIdx].updated_at = nowISO()

  writeGoals(brand, goals)
  return goals[goalIdx]
}
