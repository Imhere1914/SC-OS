/**
 * /api/site-studio — Lovable-style natural-language website editing. Wraps the
 * Dev Studio agent runner: an edit spawns Claude Code in the site repo, builds,
 * and (on approval) the dist/ is rsynced live. Progress is followed via the
 * existing /api/dev/tasks/:id + /log endpoints (per-site brand namespace).
 */
import type { Hono } from 'hono'
import {
  SITES,
  isSiteKey,
  isServerEnvironment,
  siteStatus,
  startSiteEdit,
  buildSitePreview,
  deploySite,
  revertLastSiteEdit,
  type SiteKey,
} from '../lib/site-studio'

export function registerSiteStudio(app: Hono): void {
  // GET /api/site-studio/status — server flag + both sites' status
  app.get('/api/site-studio/status', (c) => {
    return c.json({
      server: isServerEnvironment(),
      sites: (Object.keys(SITES) as SiteKey[]).map((k) => siteStatus(k)),
    })
  })

  // POST /api/site-studio/:site/edit — natural-language change → dev-task
  app.post('/api/site-studio/:site/edit', async (c) => {
    const site = c.req.param('site')
    if (!isSiteKey(site)) return c.json({ error: 'Unknown site' }, 404)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body.prompt !== 'string' || !body.prompt.trim())
      return c.json({ error: 'prompt is required' }, 400)
    const res = startSiteEdit(site, body.prompt)
    if (!res.ok) return c.json({ error: res.error }, 400)
    return c.json({ taskId: res.taskId }, 201)
  })

  // POST /api/site-studio/:site/build — npm run build (dist/ becomes preview)
  app.post('/api/site-studio/:site/build', (c) => {
    const site = c.req.param('site')
    if (!isSiteKey(site)) return c.json({ error: 'Unknown site' }, 404)
    const res = buildSitePreview(site)
    return c.json(res, res.ok ? 200 : 400)
  })

  // POST /api/site-studio/:site/deploy — commit + build + rsync to nginx
  app.post('/api/site-studio/:site/deploy', async (c) => {
    const site = c.req.param('site')
    if (!isSiteKey(site)) return c.json({ error: 'Unknown site' }, 404)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const summary = typeof body.summary === 'string' ? body.summary : undefined
    const res = deploySite(site, summary)
    return c.json(res, res.ok ? 200 : 400)
  })

  // POST /api/site-studio/:site/revert — undo last Site Studio commit + redeploy
  app.post('/api/site-studio/:site/revert', (c) => {
    const site = c.req.param('site')
    if (!isSiteKey(site)) return c.json({ error: 'Unknown site' }, 404)
    const res = revertLastSiteEdit(site)
    return c.json(res, res.ok ? 200 : 400)
  })
}
