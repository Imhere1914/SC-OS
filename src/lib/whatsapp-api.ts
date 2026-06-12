export async function sendWhatsApp(
  to: string,
  body: string,
  contactId?: string,
  contactName?: string,
): Promise<{ ok: boolean; message_id?: string; conversation_id?: string; error?: string }> {
  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body, contact_id: contactId, contact_name: contactName }),
  })
  return res.json()
}

export async function getWhatsAppStatus(): Promise<{ configured: boolean; phone_number_id: string | null }> {
  const res = await fetch('/api/whatsapp/status')
  return res.json()
}
