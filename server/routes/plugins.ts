import type { Hono } from 'hono'
import { PLUGINS } from '../stores/plugins-catalog'
import { envConfigured, getEnabledMap, setPluginEnabled } from '../stores/plugins-store'

export function registerPlugins(app: Hono): void {
  app.get('/api/plugins-catalog', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') || 'default'
    const enabled = getEnabledMap(brand)
    const plugins = PLUGINS.map((p) => ({ ...p, enabled: enabled[p.id] === true, configured: envConfigured(p.env_vars) }))
    return c.json({ plugins })
  })
  app.post('/api/plugins-catalog', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.plugin_id !== 'string') return c.json({ error: 'plugin_id is required' }, 400)
    if (typeof b.enabled !== 'boolean') return c.json({ error: 'enabled (boolean) is required' }, 400)
    if (!PLUGINS.some((p) => p.id === b.plugin_id)) return c.json({ error: 'Unknown plugin' }, 404)
    setPluginEnabled(b.plugin_id, typeof b.brand === 'string' ? b.brand : 'default', b.enabled)
    return c.json({ ok: true })
  })
}
