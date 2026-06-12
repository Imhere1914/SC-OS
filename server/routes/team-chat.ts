/**
 * /api/team-chat — internal team chat (Slack replacement).
 * Channels, DMs, messages, read markers, and Hermes-in-channel AI replies.
 */
import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import {
  createChannel,
  deleteChannel,
  deleteMessage,
  editMessage,
  getChannel,
  getOrCreateDm,
  getUnreadCounts,
  listChannels,
  listMessages,
  markRead,
  postMessage,
  updateChannel,
  type ChatMessage,
} from '../stores/team-chat-store'

// ── Hermes in-channel AI reply ────────────────────────────────────────────────

interface OpenRouterResponse {
  choices?: Array<{ message?: { content: string | null } }>
}

async function callHermesForChannel(history: ChatMessage[], userMessage: ChatMessage): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
  const model = process.env.MODEL ?? 'minimax/minimax-m3'

  const systemPrompt =
    'You are Hermes, the AI teammate inside the company\'s internal team chat. ' +
    'You were mentioned with @hermes in a channel. Reply helpfully and concisely ' +
    '(a few sentences unless more detail is clearly needed), in a friendly coworker tone. ' +
    'Plain text only — no markdown headings. The recent channel conversation is provided for context.'

  const transcript = [...history, userMessage]
    .map((m) => `${m.author_name}: ${m.body}`)
    .join('\n')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ai-os.app',
      'X-Title': 'AI OS Team Chat',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Recent channel messages:\n${transcript}\n\nRespond to the last message (it mentioned you).` },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = (await res.json()) as OpenRouterResponse
  const reply = data.choices?.[0]?.message?.content
  if (!reply) throw new Error('empty response')
  return reply
}

function triggerHermesReply(brand: string, channelId: string, userMessage: ChatMessage): void {
  void (async () => {
    try {
      // last 10 messages before the new one for context
      const history = listMessages(brand, channelId, { before: userMessage.id, limit: 10 })
      const reply = await callHermesForChannel(history, userMessage)
      postMessage(brand, channelId, {
        author_id: 'hermes',
        author_name: 'Hermes',
        body: reply,
        is_ai: true,
      })
    } catch (err) {
      console.error('[team-chat] Hermes reply failed:', (err as Error).message)
      postMessage(brand, channelId, {
        author_id: 'hermes',
        author_name: 'Hermes',
        body: 'I hit an error responding — please try again in a moment.',
        is_ai: true,
      })
    }
  })()
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerTeamChat(app: Hono): void {
  // GET /api/team-chat/channels?member_id= — channels + unread counts
  app.get('/api/team-chat/channels', (c) => {
    const brand = getBrandId(c)
    const memberId = c.req.query('member_id') ?? undefined
    const channels = listChannels(brand, memberId)
    const unread = memberId ? getUnreadCounts(brand, memberId) : {}
    return c.json({
      channels: channels.map((ch) => ({ ...ch, unread_count: unread[ch.id] ?? 0 })),
    })
  })

  // POST /api/team-chat/channels — create channel
  app.post('/api/team-chat/channels', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.name || typeof body.name !== 'string' || !body.name.trim())
      return c.json({ error: 'name is required' }, 400)
    const channel = createChannel(brand, {
      name: body.name,
      description: typeof body.description === 'string' ? body.description : undefined,
      member_ids: Array.isArray(body.member_ids) ? (body.member_ids as string[]) : [],
      is_private: body.is_private === true,
      created_by: typeof body.created_by === 'string' ? body.created_by : undefined,
    })
    return c.json({ channel }, 201)
  })

  // PATCH /api/team-chat/channels/:id — rename / description / members
  app.patch('/api/team-chat/channels/:id', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const channel = updateChannel(brand, c.req.param('id'), {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      member_ids: Array.isArray(body.member_ids) ? (body.member_ids as string[]) : undefined,
      is_private: typeof body.is_private === 'boolean' ? body.is_private : undefined,
    })
    if (!channel) return c.json({ error: 'Channel not found' }, 404)
    return c.json({ channel })
  })

  // DELETE /api/team-chat/channels/:id
  app.delete('/api/team-chat/channels/:id', (c) => {
    const brand = getBrandId(c)
    const ok = deleteChannel(brand, c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'Channel not found' }, 404)
  })

  // POST /api/team-chat/dm — get or create a DM
  app.post('/api/team-chat/dm', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const memberIds = Array.isArray(body.member_ids) ? (body.member_ids as string[]) : []
    if (memberIds.length < 2) return c.json({ error: 'member_ids must include at least 2 members' }, 400)
    const channel = getOrCreateDm(brand, memberIds)
    return c.json({ channel })
  })

  // GET /api/team-chat/channels/:id/messages?before=&limit=
  app.get('/api/team-chat/channels/:id/messages', (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    if (!getChannel(brand, id)) return c.json({ error: 'Channel not found' }, 404)
    const before = c.req.query('before') ?? undefined
    const limitRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined
    return c.json({ messages: listMessages(brand, id, { before, limit }) })
  })

  // POST /api/team-chat/channels/:id/messages — post message (Hermes async if mentioned)
  app.post('/api/team-chat/channels/:id/messages', async (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body.author_id !== 'string' || !body.author_id)
      return c.json({ error: 'author_id is required' }, 400)
    if (typeof body.body !== 'string' || !body.body.trim())
      return c.json({ error: 'body is required' }, 400)
    const message = postMessage(brand, id, {
      author_id: body.author_id,
      author_name: typeof body.author_name === 'string' ? body.author_name : 'Unknown',
      body: body.body,
    })
    if (!message) return c.json({ error: 'Channel not found' }, 404)
    if (message.mentions.includes('hermes') && !message.is_ai) {
      triggerHermesReply(brand, id, message)
    }
    return c.json({ message }, 201)
  })

  // PATCH /api/team-chat/channels/:id/messages/:messageId — edit
  app.patch('/api/team-chat/channels/:id/messages/:messageId', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body.body !== 'string' || !body.body.trim())
      return c.json({ error: 'body is required' }, 400)
    const message = editMessage(brand, c.req.param('id'), c.req.param('messageId'), body.body)
    if (!message) return c.json({ error: 'Message not found' }, 404)
    return c.json({ message })
  })

  // DELETE /api/team-chat/channels/:id/messages/:messageId
  app.delete('/api/team-chat/channels/:id/messages/:messageId', (c) => {
    const brand = getBrandId(c)
    const ok = deleteMessage(brand, c.req.param('id'), c.req.param('messageId'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'Message not found' }, 404)
  })

  // POST /api/team-chat/channels/:id/read — mark channel read
  app.post('/api/team-chat/channels/:id/read', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body.member_id !== 'string' || !body.member_id)
      return c.json({ error: 'member_id is required' }, 400)
    const marker = markRead(brand, body.member_id, c.req.param('id'))
    return c.json({ marker })
  })
}
