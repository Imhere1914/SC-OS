/**
 * /api/chat — AI assistant with OpenRouter + Knowledge Vault context.
 *
 * Priority:
 *  1. OpenRouter (OPENROUTER_API_KEY set) — live LLM call with knowledge context
 *  2. Hermes session-send bridge (HERMES_API_URL set, no OpenRouter key) — fire & poll
 *  3. Keyword fallback — offline canned responses
 *
 * Default model: openai/gpt-4o-mini (cheap, conversational, tool-capable)
 * Override via CHAT_MODEL or MODEL env var.
 */
import type { Hono } from 'hono'
import { buildAssistantContext } from '../stores/knowledge-store'
import { AI_TOOLS } from '../lib/ai-tools'
import { executeToolCall, type ToolArgs } from '../lib/ai-actions'
import { buildBusinessContext } from '../lib/business-context'
import { getChatModel } from '../stores/preferences-store'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

interface OpenRouterMessage {
  content: string | null
  tool_calls?: ToolCall[]
}

interface OpenRouterResponse {
  choices?: Array<{ message?: OpenRouterMessage }>
  model?: string
}

// ── Brand helpers ─────────────────────────────────────────────────────────────

function brandId(): string { return (process.env.BRAND ?? 'default').toLowerCase() }

function brandName(): string {
  const b = brandId()
  if (b === 'hfm') return 'Holistic Functional Care'
  if (b === 'sc') return 'Simple Connect'
  return 'AI OS'
}

function defaultModel(): string {
  return getChatModel()
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(brand?: string): string {
  const b = brand ?? brandId()
  const knowledgeCtx = buildAssistantContext(b)
  const businessCtx = buildBusinessContext(b)

  // ── Brand persona ────────────────────────────────────────────────────────────
  const persona = b === 'hfm'
    ? `You are Hermes, the AI companion for Holistic Functional Care — a women's holistic and functional wellness practice. Your voice is warm, calm, and nurturing. You speak with care and encouragement ("let's gently…", "a lovely place to start is…"), never clinical or rushed. You honor the whole person and the practice's compassionate, holistic philosophy. You help the practitioner run the practice — appointments, patient communications, intake, content, campaigns — and support patients with kindness.

IMPORTANT BOUNDARY: You are a wellness-practice operations companion, NOT a medical provider. NEVER diagnose conditions, prescribe treatments, recommend specific supplements or dosages, or give individualized medical advice. Share only general wellness education, and always, warmly, direct any clinical or personal-health question back to the practitioner.`
    : b === 'sc'
    ? `You are Hermes, the AI operations partner for Simple Connect — an AI-powered virtual office manager for home-service businesses (HVAC, plumbing, contractors). Your voice is confident, friendly, and strategic. You're an upbeat, sharp teammate who gets things done — and you think like a growth advisor, framing things around pipeline, conversion, revenue, and outcomes. You're direct and practical, but personable. When you see an opportunity to move a deal forward or capture more revenue, you say so.`
    : `You are Hermes, a smart, friendly business operations co-pilot.`

  const base = `${persona}

You help manage the business through this AI Operating System: pipeline, contacts, conversations, appointments, campaigns, social posts, projects, pages, templates, media, and automations. When asked about data, summarize what you know clearly. When asked to do something, take the action or describe the steps. You can generate images with AI (saved to the Media Studio gallery), start video renders that finish in Media Studio a few minutes later, and post to connected social channels. You're aware of the platform's modules: Dashboard, Assistant, Highlights, Knowledge Vault, Conversations, Contacts, Appointments, Social, Campaigns, Pages, Templates, Media Studio, Projects, Automations, Site Studio.

## How to talk
Sound like a real person, not a bot. Write the way a sharp, warm colleague texts — natural, flowing sentences, a little personality, contractions, the occasional aside. Vary your rhythm. React to what they actually said before diving in. Never robotic, never a wall of bullet points unless they ask for a list. Be genuinely helpful and concise, but human first. Don't over-explain or pad. If something's good news, sound a little pleased; if something needs attention, say so plainly and kindly.`

  const withKnowledge = knowledgeCtx ? `${base}\n\n## Business Knowledge\n${knowledgeCtx}` : base

  return businessCtx ? `${withKnowledge}\n\n${businessCtx}` : withKnowledge
}

// ── OpenRouter direct call ────────────────────────────────────────────────────

async function callOpenRouter(messages: ChatMessage[], brand: string): Promise<{ reply: string; live: boolean; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('no key')

  const model = defaultModel()
  const systemPrompt = buildSystemPrompt(brand)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://ai-os.app',
    'X-Title': brandName(),
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      tools: AI_TOOLS,
      tool_choice: 'auto',
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as OpenRouterResponse
  const msg = data.choices?.[0]?.message

  // Handle tool calls — execute them, then follow up for natural-language reply
  if (msg?.tool_calls && msg.tool_calls.length > 0) {
    const toolResults = await Promise.all(
      msg.tool_calls.map(async (tc: ToolCall) => {
        const args = JSON.parse(tc.function.arguments) as ToolArgs
        const result = await executeToolCall(brandId(), tc.function.name, args)
        return {
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        }
      })
    )

    const followUpRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          { role: 'assistant', content: null, tool_calls: msg.tool_calls },
          ...toolResults,
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!followUpRes.ok) {
      const err = await followUpRes.text().catch(() => '')
      throw new Error(`OpenRouter follow-up ${followUpRes.status}: ${err.slice(0, 200)}`)
    }

    const followUpData = (await followUpRes.json()) as OpenRouterResponse
    const finalReply = followUpData.choices?.[0]?.message?.content ?? 'Done.'
    return { reply: finalReply, live: true, model: data.model ?? model }
  }

  const reply = msg?.content ?? ''
  if (!reply) throw new Error('empty response')
  return { reply, live: true, model: data.model ?? model }
}

// ── Hermes session-send bridge ────────────────────────────────────────────────
// Fires the message to Hermes and polls /api/session-history for the reply.
// Uses sessionKey 'ai-os' to keep a dedicated conversation thread.

const HERMES_SESSION_KEY = 'ai-os'
const HERMES_POLL_INTERVAL_MS = 1000
const HERMES_POLL_MAX_ATTEMPTS = 30 // 30 s

async function callHermesBridge(messages: ChatMessage[]): Promise<{ reply: string; live: boolean; model: string }> {
  const base = process.env.HERMES_API_URL?.replace(/\/$/, '')
  if (!base) throw new Error('no hermes url')
  const token = process.env.HERMES_API_TOKEN ?? ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // Send the message
  const sendRes = await fetch(`${base}/api/session-send`, {
    method: 'POST', headers,
    body: JSON.stringify({ sessionKey: HERMES_SESSION_KEY, message: lastUserMsg }),
  })
  if (!sendRes.ok) throw new Error(`Hermes send ${sendRes.status}`)

  // Poll history until a new assistant turn appears after the message we sent
  const sentAt = Date.now()
  for (let i = 0; i < HERMES_POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, HERMES_POLL_INTERVAL_MS))
    const histRes = await fetch(`${base}/api/session-history?sessionKey=${HERMES_SESSION_KEY}&limit=20`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null)
    if (!histRes?.ok) continue
    const data = (await histRes.json()) as { messages?: Array<{ role: string; content: string; created_at?: string }> }
    const msgs = data.messages ?? []
    const newAssistant = msgs.find(m =>
      m.role === 'assistant' &&
      (m.created_at ? Date.parse(m.created_at) > sentAt - 500 : true)
    )
    if (newAssistant?.content) {
      return { reply: newAssistant.content, live: true, model: 'hermes-agent' }
    }
  }
  throw new Error('Hermes reply timeout')
}

// ── Keyword fallback ──────────────────────────────────────────────────────────

function fallbackReply(text: string): string {
  const t = text.toLowerCase()
  const name = brandName()
  if (/\b(hi|hello|hey)\b/.test(t)) return `Hi! I'm the ${name} assistant. I can help you manage conversations, contacts, campaigns, social posts, appointments, pages, automations and more. What would you like to do?`
  if (t.includes('campaign')) return `You can create and send email campaigns from the Campaigns module. Tell me the audience and subject, and I'll help you draft it.`
  if (t.includes('appointment') || t.includes('schedule')) return `Appointments live in the Appointments module. I can help you book, reschedule, or review upcoming visits.`
  if (t.includes('social') || t.includes('post')) return `I can help you draft and schedule social posts in the Social module.`
  if (t.includes('automation')) return `The Automations module lets you build IF/THEN rules — pick a trigger, add conditions, and define actions like sending emails, updating stages, or creating tasks.`
  if (t.includes('lead') || t.includes('contact')) return `Your pipeline is in the Contacts module. I can summarise new leads or help you follow up.`
  if (t.includes('knowledge') || t.includes('brand')) return `Add entries to the Knowledge Vault and I'll use them as context in every reply — brand voice, ICP, services, FAQs, and more.`
  return `I've noted: "${text.slice(0, 80)}". To get live AI replies, set OPENROUTER_API_KEY in your .env file. Until then I'm operating in offline mode, but can still guide you through any module.`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export function registerChat(app: Hono): void {
  app.post('/api/chat', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const raw = Array.isArray(b.messages) ? b.messages : []
    const messages: ChatMessage[] = raw
      .filter((m): m is { role: string; content: string } =>
        !!m && typeof (m as Record<string, unknown>).content === 'string')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

    if (messages.length === 0) return c.json({ error: 'messages is required' }, 400)

    const brand = c.req.query('brand') ?? process.env.BRAND ?? 'default'

    // 1. OpenRouter (preferred — cheapest path, full context)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const result = await callOpenRouter(messages, brand)
        return c.json({ ...result, brand: brandName() })
      } catch (err) {
        console.error('[chat] OpenRouter error:', (err as Error).message)
        // fall through to next adapter
      }
    }

    // 2. Hermes bridge (if configured)
    if (process.env.HERMES_API_URL) {
      try {
        const result = await callHermesBridge(messages)
        return c.json({ ...result, brand: brandName() })
      } catch (err) {
        console.error('[chat] Hermes bridge error:', (err as Error).message)
        // fall through to fallback
      }
    }

    // 3. Offline keyword fallback
    const reply = fallbackReply(messages[messages.length - 1]?.content ?? '')
    return c.json({ reply, live: false, model: 'fallback', brand: brandName() })
  })

  // Health check — tells the UI which backend is active
  app.get('/api/chat/status', (c) => {
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
    const hasHermes = !!process.env.HERMES_API_URL
    return c.json({
      backend: hasOpenRouter ? 'openrouter' : hasHermes ? 'hermes' : 'fallback',
      model: hasOpenRouter ? defaultModel() : hasHermes ? 'hermes-agent' : 'fallback',
      live: hasOpenRouter || hasHermes,
    })
  })
}
