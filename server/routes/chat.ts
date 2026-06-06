import type { Hono } from 'hono'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function brandName(): string {
  const b = (process.env.BRAND ?? '').toLowerCase()
  if (b === 'hfm') return 'Holistic Functional Care'
  if (b === 'sc') return 'Simple Connect'
  return 'AI OS'
}

function fallbackReply(text: string): string {
  const t = text.toLowerCase()
  const name = brandName()
  if (/\b(hi|hello|hey)\b/.test(t)) return `Hi! I'm the ${name} assistant. I can help you manage conversations, contacts, campaigns, social posts, appointments, pages and more. What would you like to do?`
  if (t.includes('campaign')) return `You can create and send email campaigns from the Campaigns tab. Tell me the audience and subject, and I'll help you draft it.`
  if (t.includes('appointment') || t.includes('schedule')) return `Appointments live in the Appointments tab. I can help you book, reschedule, or review upcoming visits.`
  if (t.includes('social') || t.includes('post')) return `I can help you draft and schedule social posts in the Social tab.`
  if (t.includes('lead') || t.includes('contact')) return `Your pipeline is in the Contacts tab. I can summarize new leads or help you follow up.`
  return `I've noted: "${text}". The live Hermes agent isn't connected yet (set HERMES_API_URL to enable full orchestration), but I can still guide you through any module — conversations, contacts, campaigns, social, pages, appointments, projects, avatars, plugins, or media generation.`
}

async function callHermes(messages: ChatMessage[]): Promise<{ reply: string; live: boolean }> {
  const base = process.env.HERMES_API_URL
  if (!base) return { reply: fallbackReply(messages[messages.length - 1]?.content ?? ''), live: false }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HERMES_API_TOKEN ? { Authorization: `Bearer ${process.env.HERMES_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ brand: process.env.BRAND ?? 'default', messages }),
    })
    if (!res.ok) return { reply: fallbackReply(messages[messages.length - 1]?.content ?? ''), live: false }
    const data = (await res.json()) as { reply?: string; message?: string }
    const reply = data.reply ?? data.message
    return reply ? { reply, live: true } : { reply: fallbackReply(messages[messages.length - 1]?.content ?? ''), live: false }
  } catch {
    return { reply: fallbackReply(messages[messages.length - 1]?.content ?? ''), live: false }
  }
}

export function registerChat(app: Hono): void {
  app.post('/api/chat', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const raw = Array.isArray(b.messages) ? b.messages : []
    const messages: ChatMessage[] = raw
      .filter((m): m is { role: string; content: string } => !!m && typeof (m as { content?: unknown }).content === 'string')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    if (messages.length === 0) return c.json({ error: 'messages is required' }, 400)
    const { reply, live } = await callHermes(messages)
    return c.json({ reply, live, brand: brandName() })
  })
}
