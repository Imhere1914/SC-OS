/**
 * Campaign scheduler — polls every 60 s and fires any campaigns whose
 * `scheduled_at` is in the past and whose status is still 'scheduled'.
 *
 * Runs in-process (no external job queue needed for this scale).
 * Idempotent: status is set to 'sending' before any sends, so a crash-restart
 * won't double-send (the campaign won't be 'scheduled' anymore).
 */
import { listCampaigns, updateCampaign } from '../stores/campaigns-store'
import { listContacts } from '../stores/contacts-store'
import { isEmailConfigured, renderCampaignHtml, sendEmail } from '../stores/email-sender'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'
const POLL_INTERVAL_MS = 60_000 // check every minute

async function runDueCampaigns() {
  const now = new Date().toISOString()

  // Find all scheduled campaigns whose time has come
  const due = listCampaigns({ status: 'scheduled', brand: BRAND !== 'default' ? BRAND : undefined })
    .filter(c => c.scheduled_at && c.scheduled_at <= now)

  if (due.length === 0) return

  for (const campaign of due) {
    if (!isEmailConfigured()) {
      updateCampaign(campaign.id, { status: 'failed' })
      appendNotification({
        brand: BRAND,
        message: `Scheduled campaign "${campaign.name}" failed — email not configured`,
        context_summary: 'Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL',
      })
      continue
    }

    // Mark as sending immediately to prevent duplicate sends
    updateCampaign(campaign.id, { status: 'sending' })

    const recipients = listContacts({}).filter(c => {
      if (!c.email) return false
      if (c.stage === 'lost') return false
      if (!campaign.audience.include_unverified && c.unverified) return false
      if (campaign.audience.stages.length > 0 && !campaign.audience.stages.includes(c.stage)) return false
      if (campaign.audience.tags.length > 0 && !campaign.audience.tags.some(t => c.tags.includes(t))) return false
      return true
    })

    const brandName =
      campaign.brand === 'hfm' ? 'Holistic Functional Care'
      : campaign.brand === 'sc' ? 'Simple Connect'
      : 'AI OS'

    let sent = 0, failed = 0
    for (const ct of recipients) {
      if (!ct.email) continue
      const r = await sendEmail({ to: ct.email, subject: campaign.subject, html: renderCampaignHtml(campaign.body, { brandName }) })
      r.ok ? sent++ : failed++
    }

    const finalStatus = failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent'
    updateCampaign(campaign.id, {
      status: finalStatus,
      sent_at: new Date().toISOString(),
      stats: { recipients: recipients.length, sent, failed },
    })

    appendNotification({
      brand: BRAND,
      message: `Campaign "${campaign.name}" sent: ${sent}/${recipients.length} delivered`,
      context_summary: failed > 0 ? `${failed} failed` : 'All delivered',
    })

    console.log(`[scheduler] campaign "${campaign.name}" → ${sent} sent, ${failed} failed`)
  }
}

let _started = false

export function startCampaignScheduler() {
  if (_started) return
  _started = true
  // Run once immediately on startup (catches missed sends after a restart)
  void runDueCampaigns().catch(e => console.error('[scheduler] initial run error:', e))
  // Then poll
  setInterval(() => {
    void runDueCampaigns().catch(e => console.error('[scheduler] poll error:', e))
  }, POLL_INTERVAL_MS)
  console.log('[ai-os] Campaign scheduler started (60 s interval)')
}
