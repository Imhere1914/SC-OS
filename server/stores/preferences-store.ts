import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

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

export interface Preferences {
  chat_model?: string
  voice_model_id?: string
}

const FILE = 'preferences.json'

export function getPreferences(): Preferences {
  return readJson<Preferences>(FILE, {})
}

export function updatePreferences(patch: Partial<Preferences>): Preferences {
  const current = getPreferences()
  const next = { ...current, ...patch }
  writeJson(FILE, next)
  return next
}

export function getChatModel(): string {
  const prefs = getPreferences()
  return prefs.chat_model || process.env.CHAT_MODEL || process.env.MODEL || 'openai/gpt-4o-mini'
}
