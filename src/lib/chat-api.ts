/** Chat API client — talks to the Hermes agent orchestration backend. */

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function sendChat(messages: ChatMessage[]): Promise<{ reply: string; live: boolean; brand: string }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Chat failed')
  return res.json()
}
