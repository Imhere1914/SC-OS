/**
 * SMS API client — /api/sms routes.
 */

export async function sendSms(
  to: string,
  body: string,
  contactId?: string,
  contactName?: string,
): Promise<{ ok: boolean; error?: string; sid?: string; conversation_id?: string }> {
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body, contact_id: contactId, contact_name: contactName }),
  })
  const data = (await res.json()) as {
    ok: boolean
    error?: string
    sid?: string
    conversation_id?: string
  }
  if (!res.ok && data.ok !== false) {
    throw new Error(`SMS send failed: ${res.status}`)
  }
  return data
}

export async function getSmsStatus(): Promise<{
  configured: boolean
  from: string | null
}> {
  const res = await fetch('/api/sms/status')
  if (!res.ok) throw new Error('Failed to fetch SMS status')
  return res.json() as Promise<{ configured: boolean; from: string | null }>
}
