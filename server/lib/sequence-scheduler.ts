/**
 * Sequence scheduler — runs every 5 minutes.
 * Finds active enrollments where next_send_at <= now,
 * sends the current step's email, advances or completes.
 */
import {
  listEnrollments,
  getSequence,
  updateEnrollment,
} from '../stores/sequences-store'
import { isEmailConfigured, sendEmail, renderCampaignHtml } from '../stores/email-sender'

const BRAND = process.env.BRAND ?? 'default'
const BRAND_NAME =
  BRAND === 'hfm' ? 'Holistic Functional Care'
  : BRAND === 'sc' ? 'Simple Connect'
  : 'AI OS'

const INTERVAL_MS = 5 * 60 * 1_000  // 5 minutes
let _started = false

export async function runDueEnrollments(): Promise<void> {
  if (!isEmailConfigured()) return

  const now = new Date().toISOString()
  const due = listEnrollments({ status: 'active', due_before: now })
  if (!due.length) return

  console.log(`[sequence-scheduler] Processing ${due.length} due enrollment(s)`)

  for (const enrollment of due) {
    try {
      const seq = getSequence(enrollment.sequence_id)
      if (!seq || seq.status !== 'active') {
        // Sequence deactivated — pause enrollment
        updateEnrollment(enrollment.id, { status: 'unsubscribed' }, enrollment.brand)
        continue
      }

      const step = seq.steps[enrollment.current_step]
      if (!step) {
        updateEnrollment(enrollment.id, { status: 'completed', completed_at: now }, enrollment.brand)
        continue
      }

      // Substitute template vars
      const body = step.body
        .replace(/\{\{contact_name\}\}/g, enrollment.contact_name)
        .replace(/\{\{first_name\}\}/g, enrollment.contact_name.split(' ')[0] ?? enrollment.contact_name)
        .replace(/\{\{brand_name\}\}/g, BRAND_NAME)

      const subject = step.subject
        .replace(/\{\{contact_name\}\}/g, enrollment.contact_name)
        .replace(/\{\{first_name\}\}/g, enrollment.contact_name.split(' ')[0] ?? enrollment.contact_name)

      const r = await sendEmail({
        to: enrollment.contact_email,
        subject,
        html: renderCampaignHtml(body, { brandName: BRAND_NAME }),
      })

      if (!r.ok) {
        console.warn(`[sequence-scheduler] Send failed for enrollment ${enrollment.id}: ${r.error}`)
        // Don't advance — retry next cycle (or mark bounced after N failures in the future)
        continue
      }

      const nextStepIdx = enrollment.current_step + 1
      if (nextStepIdx >= seq.steps.length) {
        // Sequence complete
        updateEnrollment(enrollment.id, {
          status: 'completed',
          current_step: nextStepIdx,
          completed_at: new Date().toISOString(),
        }, enrollment.brand)
      } else {
        const nextStep = seq.steps[nextStepIdx]
        const nextSendAt = new Date(Date.now() + (nextStep.delay_days || 1) * 86_400_000).toISOString()
        updateEnrollment(enrollment.id, {
          current_step: nextStepIdx,
          next_send_at: nextSendAt,
        }, enrollment.brand)
      }
    } catch (err) {
      console.error(`[sequence-scheduler] Error processing enrollment ${enrollment.id}:`, err)
    }
  }
}

export function startSequenceScheduler(): void {
  if (_started) return
  _started = true
  console.log('[ai-os] Sequence scheduler started (5 min interval)')
  void runDueEnrollments()
  setInterval(() => void runDueEnrollments(), INTERVAL_MS)
}
