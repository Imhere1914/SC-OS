/**
 * WhatsApp Cloud API helper
 * Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_TOKEN?.trim() &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  )
}

export async function sendWhatsApp(
  to: string,
  body: string,
): Promise<{ ok: boolean; message_id?: string; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing)' }
  }

  // Normalize to E.164 — strip spaces/dashes/parens
  const normalised = to.replace(/[\s\-().+]/g, '')
  const toNum = normalised.startsWith('+') ? normalised.slice(1) : normalised

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toNum,
          type: 'text',
          text: { preview_url: false, body },
        }),
      },
    )

    const data = (await res.json()) as {
      messages?: { id: string }[]
      error?: { message: string }
    }

    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` }
    }

    return { ok: true, message_id: data.messages?.[0]?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Parse an inbound WhatsApp Cloud API webhook payload.
 * Returns the first text message found, or null if not a text message event.
 */
export function parseWhatsAppWebhook(body: Record<string, unknown>): {
  from: string
  to: string
  messageId: string
  text: string
  displayName?: string
} | null {
  try {
    const entry = (body.entry as { changes: { value: unknown }[] }[])?.[0]
    const value = entry?.changes?.[0]?.value as {
      messages?: { from: string; id: string; type: string; text?: { body: string } }[]
      contacts?: { profile?: { name?: string } }[]
      metadata?: { display_phone_number?: string; phone_number_id?: string }
    }

    if (!value?.messages?.length) return null
    const msg = value.messages[0]
    if (msg.type !== 'text' || !msg.text?.body) return null

    return {
      from: msg.from,
      to: value.metadata?.display_phone_number ?? '',
      messageId: msg.id,
      text: msg.text.body,
      displayName: value.contacts?.[0]?.profile?.name,
    }
  } catch {
    return null
  }
}
