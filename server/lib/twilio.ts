/**
 * Twilio helpers — raw fetch, no SDK.
 */

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_PHONE_NUMBER?.trim()
  )
}

export async function sendSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim()
  const token = process.env.TWILIO_AUTH_TOKEN!.trim()
  const from = process.env.TWILIO_PHONE_NUMBER!.trim()

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64')
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`

  const params = new URLSearchParams({ From: from, To: to, Body: body })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      const msg =
        typeof data.message === 'string'
          ? data.message
          : `Twilio error ${res.status}`
      return { ok: false, error: msg }
    }

    return { ok: true, sid: typeof data.sid === 'string' ? data.sid : undefined }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

export function parseTwilioWebhook(
  formBody: Record<string, string>,
): { from: string; to: string; body: string; sid: string } | null {
  const from = formBody['From']
  const to = formBody['To']
  const body = formBody['Body']
  const sid = formBody['MessageSid']

  if (!from || !to || body === undefined || !sid) return null

  return { from, to, body, sid }
}
