import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Onboarding store — tracks wizard progress per brand.
 * File-backed JSON at AIOS_DATA_DIR or ~/.ai-os.
 */

export interface OnboardingState {
  brand: string
  completed: boolean
  steps_completed: string[]   // step IDs that have been completed
  completed_at: string | null
}

const DATA_DIR =
  process.env.AIOS_DATA_DIR ?? path.join(os.homedir(), '.ai-os')

function filePath(brand: string): string {
  return path.join(DATA_DIR, `onboarding-${brand}.json`)
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function read(brand: string): OnboardingState {
  const file = filePath(brand)
  if (!fs.existsSync(file)) {
    return { brand, completed: false, steps_completed: [], completed_at: null }
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as OnboardingState
  } catch {
    return { brand, completed: false, steps_completed: [], completed_at: null }
  }
}

function write(state: OnboardingState): void {
  ensureDir()
  fs.writeFileSync(filePath(state.brand), JSON.stringify(state, null, 2), 'utf8')
}

const BRAND = process.env.BRAND ?? 'default'

export function getOnboarding(brand?: string): OnboardingState {
  return read(brand ?? BRAND)
}

export function markStepComplete(brand: string, stepId: string): OnboardingState {
  const state = read(brand)
  if (!state.steps_completed.includes(stepId)) {
    state.steps_completed = [...state.steps_completed, stepId]
  }
  write(state)
  return state
}

export function markOnboardingComplete(brand: string): OnboardingState {
  const state = read(brand)
  state.completed = true
  state.completed_at = new Date().toISOString()
  write(state)
  return state
}

export function resetOnboarding(brand: string): OnboardingState {
  const state: OnboardingState = {
    brand,
    completed: false,
    steps_completed: [],
    completed_at: null,
  }
  write(state)
  return state
}
