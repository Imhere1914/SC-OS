/**
 * /api/self-update — safe self-update pipeline for the OS itself.
 * Agents work in /opt/ai-os-staging; "Build & Deploy" promotes staging to live
 * through a gated script with build gate, health check, and auto-rollback.
 */
import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { listSelfDeploys } from '../stores/self-deploy-store'
import {
  ensureStaging,
  getStagingInfo,
  isServerEnvironment,
  readDeployLog,
  reconcileDeploy,
  refreshStaging,
  runSelfDeploy,
} from '../lib/self-update'

export function registerSelfUpdate(app: Hono): void {
  // GET /api/self-update/status — staging presence + last deploy (reconciled)
  app.get('/api/self-update/status', (c) => {
    const staging = getStagingInfo()
    const last = listSelfDeploys(1)[0] ?? null
    const lastDeploy = last ? reconcileDeploy(last.id) : null
    return c.json({
      server: isServerEnvironment(),
      staging,
      last_deploy: lastDeploy,
    })
  })

  // POST /api/self-update/staging/ensure — create staging from live if missing
  app.post('/api/self-update/staging/ensure', async (c) => {
    const result = await ensureStaging()
    return c.json(result, result.ok ? 200 : 400)
  })

  // POST /api/self-update/staging/reset — overwrite staging source from live
  app.post('/api/self-update/staging/reset', async (c) => {
    const result = await refreshStaging()
    return c.json(result, result.ok ? 200 : 400)
  })

  // POST /api/self-update/deploy — kick off the gated staging→live pipeline
  app.post('/api/self-update/deploy', (c) => {
    const brand = getBrandId(c)
    const result = runSelfDeploy(brand)
    if ('id' in result) return c.json({ id: result.id }, 201)
    return c.json(result, 400)
  })

  // GET /api/self-update/deploys/:id/log?offset= — incremental pipeline log
  app.get('/api/self-update/deploys/:id/log', (c) => {
    const id = c.req.param('id')
    const record = reconcileDeploy(id)
    if (!record) return c.json({ error: 'Deploy not found' }, 404)
    const offsetRaw = Number(c.req.query('offset'))
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
    return c.json({ ...readDeployLog(id, offset), deploy: record })
  })
}
