/** Plugins API client — /api/plugins-catalog. */

import type {
  PluginCategory,
  PluginStatus,
} from './plugins-catalog'

const API = '/api/plugins-catalog'

export type PluginItem = {
  id: string
  name: string
  description: string
  category: PluginCategory
  emoji: string
  status: PluginStatus
  env_vars: string[]
  setup: string
  enabled: boolean
  configured: boolean
}

export async function fetchPlugins(brand?: string): Promise<PluginItem[]> {
  const qs = brand ? `?brand=${encodeURIComponent(brand)}` : ''
  const res = await fetch(`${API}${qs}`)
  if (!res.ok) throw new Error(`Failed to load plugins (${res.status})`)
  const data = (await res.json()) as { plugins?: PluginItem[] }
  return Array.isArray(data.plugins) ? data.plugins : []
}

export async function setPluginEnabled(
  pluginId: string,
  enabled: boolean,
  brand?: string,
): Promise<void> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plugin_id: pluginId, enabled, brand }),
  })
  if (!res.ok) throw new Error(`Failed to update plugin (${res.status})`)
}
