import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Plugins store — tracks which catalog plugins are enabled per brand.
 * The catalog itself is static (src/lib/plugins-catalog.ts). This persists
 * the on/off state. File-backed JSON, atomic writes.
 */

export type PluginState = {
  plugin_id: string
  brand: string
  enabled: boolean
  updated_at: string
}

type PluginFile = { states: PluginState[] }

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const PLUGINS_FILE = path.join(CLAUDE_HOME, 'plugins-state.json')

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(PLUGINS_FILE)) {
    fs.writeFileSync(
      PLUGINS_FILE,
      JSON.stringify({ states: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): PluginFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(PLUGINS_FILE, 'utf-8').trim()
    if (!raw) return { states: [] }
    const parsed = JSON.parse(raw) as Partial<PluginFile>
    return { states: Array.isArray(parsed.states) ? parsed.states : [] }
  } catch {
    return { states: [] }
  }
}

function writeFile(data: PluginFile): void {
  ensureFile()
  const tmp = `${PLUGINS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, PLUGINS_FILE)
}

/** Returns a map of pluginId -> enabled for the given brand. */
export function getEnabledMap(brand: string): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const s of readFile().states) {
    if (s.brand === brand) map[s.plugin_id] = s.enabled === true
  }
  return map
}

export function setPluginEnabled(
  pluginId: string,
  brand: string,
  enabled: boolean,
): void {
  const file = readFile()
  const idx = file.states.findIndex(
    (s) => s.plugin_id === pluginId && s.brand === brand,
  )
  const now = new Date().toISOString()
  if (idx === -1) {
    file.states.push({ plugin_id: pluginId, brand, enabled, updated_at: now })
  } else {
    file.states[idx] = { ...file.states[idx], enabled, updated_at: now }
  }
  writeFile(file)
}

/** True when ALL of the given env vars are set (server-side config check). */
export function envConfigured(envVars: string[]): boolean {
  if (envVars.length === 0) return true
  return envVars.every((k) => !!process.env[k]?.trim())
}
