import type { Hono } from 'hono'
import {
  addMessage, approveDraft, createConversation, getConversation,
  isConvStatus, isMessageRole, listConversations, updateConversation,
} from '../stores/conversations-store'

function brandDraft(name: string | null): string {
  const brand = (process.env.BRAND ?? '').toLowerCase()
  const greeting = name && name !== 'Web visitor' ? `Hi ${name},` : 'Hi there,'
  if (brand === 'hfm')
    return `${greeting}\n\nThank you for reaching out to Holistic Functional Care. A member of our care team will follow up personally. Is there anything specific you'd like us to know ahead of that conversation?`
  if (brand === 'sc')
    return `${greeting}\n\nThanks for getting in touch with Simple Connect. Someone from our team will follow up shortly. Could you share a bit more about what you're looking for and your timeline?`
  return `${greeting}\n\nThanks for reaching out! We've received your message and someone will follow up shortly.`
}

export function registerConversations(app: Hono): void {
  app.get('/api/conversations', (c) => {
    const u = new URL(c.req.url)
    return c.json({ conversations: listConversations({ status: u.searchParams.get('status'), channel: u.searchParams.get('channel') }) })
  })
  app.post('/api/conversations', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const conversation = createConversation({
      contact_id: typeof b.contact_id === 'string' ? b.contact_id : null,
      contact_name: typeof b.contact_name === 'string' ? b.contact_name : null,
      subject: typeof b.subject === 'string' ? b.subject : null,
    })
    return c.json({ conversation }, 201)
  })
  app.get('/api/conversations/:id', (c) => {
    const conv = getConversation(c.req.param('id'))
    return conv ? c.json({ conversation: conv }) : c.json({ error: 'Not found' }, 404)
  })
  app.post('/api/conversations/:id', async (c) => {
    const id = c.req.param('id')
    const action = new URL(c.req.url).searchParams.get('action')
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (action === 'approve-draft') {
      if (typeof b.message_id !== 'string') return c.json({ error: 'message_id is required' }, 400)
      const conv = approveDraft(id, b.message_id)
      return conv ? c.json({ conversation: conv }) : c.json({ error: 'Not found' }, 404)
    }
    if (typeof b.body !== 'string' || !b.body.trim()) return c.json({ error: 'body is required' }, 400)
    const conv = addMessage(id, {
      role: isMessageRole(b.role) ? b.role : 'human',
      body: b.body, author: typeof b.author === 'string' ? b.author : null, draft: b.draft === true,
    })
    return conv ? c.json({ conversation: conv }, 201) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/conversations/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const conv = updateConversation(c.req.param('id'), {
      status: isConvStatus(b.status) ? b.status : undefined,
      assignee: b.assignee === null || typeof b.assignee === 'string' ? (b.assignee as string | null) : undefined,
      unread: typeof b.unread === 'boolean' ? b.unread : undefined,
      subject: b.subject === null || typeof b.subject === 'string' ? (b.subject as string | null) : undefined,
    })
    return conv ? c.json({ conversation: conv }) : c.json({ error: 'Not found' }, 404)
  })

  // Agent draft (template for now; wired to the live agent in the chat phase)
  app.post('/api/webchat/agent-draft', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.conversation_id !== 'string') return c.json({ error: 'conversation_id is required' }, 400)
    const conv = getConversation(b.conversation_id)
    if (!conv) return c.json({ error: 'Not found' }, 404)
    const updated = addMessage(conv.id, { role: 'agent', body: brandDraft(conv.contact_name), author: 'agent', draft: true })
    return updated ? c.json({ conversation: updated }, 201) : c.json({ error: 'Failed' }, 500)
  })
}
