import type { Hono } from 'hono'
import {
  createCampaign, deleteCampaign, getCampaign, isCampaignStatus,
  listCampaigns, updateCampaign,
} from '../stores/campaigns-store'
import { listContacts } from '../stores/contacts-store'
import type { ContactRecord } from '../stores/contacts-store'
import { isEmailConfigured, renderCampaignHtml, sendEmail } from '../stores/email-sender'

function resolveRecipients(a: { stages: string[]; tags: string[]; include_unverified: boolean }): ContactRecord[] {
  return listContacts({}).filter((c) => {
    if (!c.email) return false
    if (c.stage === 'lost') return false
    if (!a.include_unverified && c.unverified) return false
    if (a.stages.length > 0 && !a.stages.includes(c.stage)) return false
    if (a.tags.length > 0 && !a.tags.some((t) => c.tags.includes(t))) return false
    return true
  })
}

function parseAudience(raw: Record<string, unknown> | undefined) {
  return {
    stages: Array.isArray(raw?.stages) ? (raw!.stages as unknown[]).filter((s): s is string => typeof s === 'string') : [],
    tags: Array.isArray(raw?.tags) ? (raw!.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    include_unverified: raw?.include_unverified === true,
  }
}

export function registerCampaigns(app: Hono): void {
  app.get('/api/campaigns', (c) => {
    const u = new URL(c.req.url)
    return c.json({ campaigns: listCampaigns({ status: u.searchParams.get('status'), brand: u.searchParams.get('brand') }) })
  })
  app.post('/api/campaigns', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.name !== 'string' || !b.name) return c.json({ error: 'name is required' }, 400)
    if (typeof b.subject !== 'string' || !b.subject) return c.json({ error: 'subject is required' }, 400)
    const campaign = createCampaign({
      name: b.name, subject: b.subject,
      body: typeof b.body === 'string' ? b.body : '',
      brand: typeof b.brand === 'string' ? b.brand : undefined,
      scheduled_at: typeof b.scheduled_at === 'string' ? b.scheduled_at : null,
      audience: parseAudience(b.audience as Record<string, unknown> | undefined),
    })
    return c.json({ campaign }, 201)
  })
  app.get('/api/campaigns/:id', (c) => {
    const campaign = getCampaign(c.req.param('id'))
    if (!campaign) return c.json({ error: 'Not found' }, 404)
    return c.json({ campaign, recipient_preview: resolveRecipients(campaign.audience).length })
  })
  app.patch('/api/campaigns/:id', async (c) => {
    const id = c.req.param('id')
    if (new URL(c.req.url).searchParams.get('action') === 'send') {
      const campaign = getCampaign(id)
      if (!campaign) return c.json({ error: 'Not found' }, 404)
      if (campaign.status === 'sent') return c.json({ error: 'Already sent' }, 409)
      if (!isEmailConfigured()) {
        updateCampaign(id, { status: 'failed' })
        return c.json({ error: 'Email not configured (RESEND_API_KEY + CAMPAIGN_FROM_EMAIL)', campaign: getCampaign(id) }, 502)
      }
      const recipients = resolveRecipients(campaign.audience)
      updateCampaign(id, { status: 'sending', stats: { recipients: recipients.length, sent: 0, failed: 0 } })
      const brandName = campaign.brand === 'hfm' ? 'Holistic Functional Care' : campaign.brand === 'sc' ? 'Simple Connect' : 'AI OS'
      let sent = 0, failed = 0
      for (const ct of recipients) {
        if (!ct.email) continue
        const r = await sendEmail({ to: ct.email, subject: campaign.subject, html: renderCampaignHtml(campaign.body, { brandName }) })
        r.ok ? sent++ : failed++
      }
      const updated = updateCampaign(id, {
        status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent',
        sent_at: new Date().toISOString(), stats: { recipients: recipients.length, sent, failed },
      })
      return c.json({ campaign: updated })
    }
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const campaign = updateCampaign(id, {
      name: typeof b.name === 'string' ? b.name : undefined,
      subject: typeof b.subject === 'string' ? b.subject : undefined,
      body: typeof b.body === 'string' ? b.body : undefined,
      scheduled_at: b.scheduled_at === null || typeof b.scheduled_at === 'string' ? (b.scheduled_at as string | null) : undefined,
      status: isCampaignStatus(b.status) ? b.status : undefined,
      audience: b.audience ? parseAudience(b.audience as Record<string, unknown>) : undefined,
    })
    return campaign ? c.json({ campaign }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/campaigns/:id', (c) =>
    deleteCampaign(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
