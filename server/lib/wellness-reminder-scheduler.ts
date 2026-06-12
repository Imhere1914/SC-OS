/**
 * Wellness daily-reminder scheduler.
 *
 * Polls hourly and, once per day at a sensible hour (17:00 UTC), sends a gentle
 * "your daily plan is waiting" nudge to opted-in HFM patients who:
 *   - have reminder_email_opt_in === true,
 *   - have an email on file,
 *   - have NOT completed today's daily plan,
 *   - and haven't already received a reminder today.
 *
 * Channel: email via the existing Resend-backed email sender (only when
 * isEmailConfigured()). Everything is wrapped in try/catch — this never throws.
 *
 * Safe to start on any instance: it no-ops when there are no opted-in patients,
 * no email config, or it's not the send hour. Reminders are HFM-only by design.
 */
import { isEmailConfigured, renderTransactionalHtml, sendEmail } from '../stores/email-sender'
import { listProgress, markReminderSent } from '../stores/wellness-store'

const REMINDER_BRAND = 'hfm'
const SEND_HOUR_UTC = 17
const POLL_INTERVAL_MS = 60 * 60 * 1000 // hourly
const WELLNESS_URL = 'https://os.holisticfunctionalcare.com/wellness'
const BRAND_NAME = 'Holistic Functional Care'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function runReminders(): Promise<void> {
  try {
    const now = new Date()
    if (now.getUTCHours() !== SEND_HOUR_UTC) return
    if (!isEmailConfigured()) return

    const today = todayISO()
    const patients = listProgress(REMINDER_BRAND).filter(p => {
      if (p.reminder_email_opt_in !== true) return false
      const email = p.reminder_email ?? p.patient_email
      if (!email) return false
      if (p.reminder_last_sent_date === today) return false           // already nudged today
      const doneToday = p.daily_plan?.date === today && p.daily_plan.completed === true
      if (doneToday) return false                                     // already finished today
      return true
    })

    if (patients.length === 0) return

    let sent = 0
    for (const p of patients) {
      const email = p.reminder_email ?? p.patient_email
      if (!email) continue
      try {
        const greeting = p.patient_name ? `Hi ${p.patient_name},` : 'Hi there,'
        const lines = [
          greeting,
          'Your daily wellness plan is waiting for you today — just three small, gentle steps toward feeling your best. 🌿',
        ]
        if ((p.streak_days ?? 0) > 0) {
          lines.push(`You're on a **${p.streak_days}-day streak** — keep it glowing! ✨`)
        }
        lines.push('It only takes a few mindful minutes. We\'ll be right here when you\'re ready.')

        const html = renderTransactionalHtml({
          brandName: BRAND_NAME,
          heading: 'Your daily wellness plan is waiting 🌿',
          lines,
          ctaLabel: 'Open today\'s plan',
          ctaUrl: WELLNESS_URL,
        })

        const r = await sendEmail({
          to: email,
          subject: 'Your daily wellness plan is waiting 🌿',
          html,
        })
        if (r.ok) {
          markReminderSent(REMINDER_BRAND, p.token, today)
          sent += 1
        }
      } catch (err) {
        console.error('[wellness-reminder] send error:', err instanceof Error ? err.message : err)
      }
    }

    if (sent > 0) console.log(`[wellness-reminder] sent ${sent} daily nudge(s)`)
  } catch (err) {
    console.error('[wellness-reminder] run error:', err instanceof Error ? err.message : err)
  }
}

let _started = false

export function startWellnessReminderScheduler(): void {
  if (_started) return
  _started = true
  void runReminders()
  setInterval(() => { void runReminders() }, POLL_INTERVAL_MS)
  console.log('[ai-os] Wellness reminder scheduler started (hourly check, 17:00 UTC send)')
}
