/**
 * AI tool action executor — maps OpenRouter tool calls to real store operations.
 */

import { listContacts, createContact as storeCreateContact } from '../stores/contacts-store'
import { listDeals, createDeal as storeCreateDeal } from '../stores/deals-store'
import { listAppointments } from '../stores/appointments-store'
import { listInvoices } from '../stores/invoices-store'
import { createMedia, updateMedia } from '../stores/media-store'
import { createPost, markFailed, markPublished, updatePost } from '../stores/social-store'
import { generateImage, generateVideo } from './media-generator'
import {
  channelStatus, isPublishPlatform, publishToPlatforms,
  type PublishPlatform,
} from './social-publishers'
import { getOwnEngagement, searchAdLibrary } from './social-intel'

export type ToolArgs = Record<string, unknown>

export async function executeToolCall(brand: string, name: string, args: ToolArgs): Promise<unknown> {
  switch (name) {
    case 'create_contact': {
      const contact = storeCreateContact({
        name: String(args['name']),
        email: args['email'] ? String(args['email']) : undefined,
        phone: args['phone'] ? String(args['phone']) : undefined,
        company: args['company'] ? String(args['company']) : undefined,
        tags: Array.isArray(args['tags']) ? args['tags'].map(String) : [],
        notes: args['notes'] ? String(args['notes']) : undefined,
        stage: 'lead',
        source: 'manual',
      })
      return { success: true, contact: { id: contact.id, name: contact.name } }
    }
    case 'create_deal': {
      const deal = storeCreateDeal({
        brand,
        title: String(args['title']),
        contact_name: args['contact_name'] ? String(args['contact_name']) : undefined,
        stage: (args['stage'] as 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost') || 'lead',
        value: typeof args['value_cents'] === 'number' ? args['value_cents'] : 0,
        notes: args['notes'] ? String(args['notes']) : undefined,
      })
      return { success: true, deal: { id: deal.id, title: deal.title, stage: deal.stage } }
    }
    case 'lookup_contacts': {
      const search = args['search'] ? String(args['search']) : undefined
      const limit = typeof args['limit'] === 'number' ? args['limit'] : 5
      const all = listContacts({ search: search ?? null })
      return all.slice(0, limit).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        status: c.stage,
      }))
    }
    case 'list_deals': {
      const all = listDeals(brand)
      const stage = args['stage'] ? String(args['stage']) : null
      const limit = typeof args['limit'] === 'number' ? args['limit'] : 5
      const filtered = stage ? all.filter(d => d.stage === stage) : all
      return filtered.slice(0, limit).map(d => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value_cents: d.value,
      }))
    }
    case 'list_appointments': {
      const limit = typeof args['limit'] === 'number' ? args['limit'] : 5
      const upcoming = listAppointments({ brand, when: 'upcoming' })
      return upcoming.slice(0, limit).map(a => ({
        id: a.id,
        title: a.title,
        contact_name: a.contact_name,
        start_time: a.starts_at,
      }))
    }
    case 'get_business_summary': {
      const contacts = listContacts({})
      const deals = listDeals(brand)
      const invoices = listInvoices(brand)
      const appointments = listAppointments({ brand, when: 'upcoming' })
      const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage))
      const unpaidInvoices = invoices.filter(i => i.status === 'sent')
      return {
        total_contacts: contacts.length,
        open_deals: openDeals.length,
        open_deal_value: openDeals.reduce((s, d) => s + (d.value || 0), 0),
        unpaid_invoices: unpaidInvoices.length,
        upcoming_appointments: appointments.length,
      }
    }
    case 'generate_image': {
      const prompt = String(args['prompt'] ?? '').trim()
      if (!prompt) return { success: false, error: 'prompt is required' }
      const aspect = args['aspect'] === '16:9' || args['aspect'] === '9:16' ? String(args['aspect']) : '1:1'
      const rec = createMedia({ kind: 'image', prompt, aspect, brand })
      const result = await generateImage(prompt, aspect)
      if ('url' in result) {
        updateMedia(rec.id, { status: 'ready', url: result.url, provider: result.provider })
        return {
          success: true,
          image_url: result.url,
          provider: result.provider,
          note: 'Saved to Media Studio. The user can view it at the URL.',
        }
      }
      updateMedia(rec.id, { status: 'failed', error: result.error })
      return { success: false, error: result.error }
    }
    case 'generate_video': {
      const prompt = String(args['prompt'] ?? '').trim()
      if (!prompt) return { success: false, error: 'prompt is required' }
      const aspect = args['aspect'] === '16:9' || args['aspect'] === '9:16' ? String(args['aspect']) : '1:1'
      const rec = createMedia({ kind: 'video', prompt, aspect, brand })
      // Video renders take minutes — run in the background and report progress
      // via the Media Studio gallery record instead of blocking the chat turn.
      void (async () => {
        try {
          const result = await generateVideo(prompt, aspect)
          if ('url' in result) {
            updateMedia(rec.id, { status: 'ready', url: result.url, provider: result.provider })
          } else {
            updateMedia(rec.id, { status: 'failed', error: result.error })
          }
        } catch (e) {
          updateMedia(rec.id, { status: 'failed', error: (e as Error).message })
        }
      })()
      return { success: true, note: 'Video render started — it will appear in Media Studio in a few minutes.' }
    }
    case 'post_to_social': {
      const text = String(args['text'] ?? '').trim()
      if (!text) return { success: false, error: 'text is required' }

      // Resolve target platforms — default to whatever's connected for this brand.
      const status = channelStatus(brand)
      const requested = Array.isArray(args['platforms'])
        ? args['platforms'].filter(isPublishPlatform)
        : (Object.keys(status) as PublishPlatform[]).filter((p) => status[p])
      if (requested.length === 0) {
        return {
          success: false,
          error:
            'No social channels are connected for this brand. Connect Facebook, Instagram, LinkedIn, or TikTok in Settings (tokens are set server-side via env).',
        }
      }

      // Optionally generate an image to attach first.
      const mediaUrls: string[] = []
      let imageError: string | undefined
      const imagePrompt = args['image_prompt'] ? String(args['image_prompt']).trim() : ''
      if (imagePrompt) {
        const rec = createMedia({ kind: 'image', prompt: imagePrompt, aspect: '1:1', brand })
        const img = await generateImage(imagePrompt, '1:1')
        if ('url' in img) {
          updateMedia(rec.id, { status: 'ready', url: img.url, provider: img.provider })
          mediaUrls.push(img.url)
        } else {
          updateMedia(rec.id, { status: 'failed', error: img.error })
          imageError = img.error
        }
      }

      const link = args['link'] ? String(args['link']) : undefined
      const post = createPost({
        content: text,
        platforms: requested,
        media_urls: mediaUrls,
        brand,
        created_by: 'hermes',
      })

      const results = await publishToPlatforms(brand, requested, { text, mediaUrls, link })
      const anyOk = results.some((r) => r.ok)
      const allOk = results.every((r) => r.ok)
      const externalIds: Record<string, string> = {}
      for (const r of results) if (r.ok && r.id) externalIds[r.platform] = r.id

      if (allOk) {
        markPublished(post.id, externalIds)
      } else if (anyOk) {
        updatePost(post.id, {
          status: 'failed',
          external_ids: externalIds,
          notes: results.filter((r) => !r.ok).map((r) => `${r.platform}: ${r.error}`).join('; '),
        })
      } else {
        markFailed(post.id, results.map((r) => `${r.platform}: ${r.error}`).join('; '))
      }

      return {
        success: anyOk,
        post_id: post.id,
        image_generated: mediaUrls.length > 0,
        image_error: imageError,
        results: results.map((r) => ({ platform: r.platform, ok: r.ok, error: r.error, url: r.url })),
      }
    }
    case 'analyze_post_performance': {
      const platform = args['platform'] ? String(args['platform']) : undefined
      const summary = await getOwnEngagement(brand, platform)
      return {
        analyzed_posts: summary.analyzed_posts,
        live_metrics: summary.live_metrics,
        totals: summary.totals,
        avg_engagement_per_post: summary.avg_engagement_per_post,
        best_platform: summary.best_platform,
        best_day: summary.best_day,
        best_hour: summary.best_hour,
        by_image: summary.by_image,
        top_posts: summary.top_posts.map((p) => ({
          content: p.content.slice(0, 140),
          platform: p.platform,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          total: p.total,
        })),
        note: summary.note,
      }
    }
    case 'research_ad_trends': {
      const query = String(args['query'] ?? '').trim()
      if (!query) return { ok: false, error: 'query is required' }
      const result = await searchAdLibrary(query)
      return result
    }
    case 'create_task':
      return { success: false, message: 'Task creation requires a project ID. Please specify the project first.' }
    case 'deploy_agents': {
      const { listAgents, createTask: createAgentTask } = await import('../stores/agents-store')
      const agents = listAgents().filter(a => a.active)
      const goal = String(args['goal'] ?? '')
      const context = args['context'] ? String(args['context']) : undefined

      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) return { error: 'No API key configured for agent orchestration' }

      const { getChatModel } = await import('../stores/preferences-store')
      const agentList = agents.map(a => `- ${a.name} (${a.role}): ${a.description}`).join('\n')
      const prompt = `Decompose this business goal into specific tasks. Assign each to the most appropriate agent role.\n\nAgents:\n${agentList}\n\nGoal: "${goal}"${context ? `\nContext: ${context}` : ''}\n\nJSON array of: {"agent_role":"...","title":"short action","description":"specifics","priority":"low|normal|high|urgent"}\nOnly the JSON array.`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: getChatModel(), messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      })
      if (!res.ok) return { error: 'Failed to plan tasks' }

      const data = await res.json() as { choices: { message: { content: string } }[] }
      const raw = data.choices[0]?.message?.content ?? '[]'
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return { error: 'Could not parse task plan' }

      const planned = JSON.parse(jsonMatch[0]) as { agent_role: string; title: string; description: string; priority: string }[]

      const parentTask = createAgentTask({
        agent_id: agents[0]?.id ?? '', title: goal,
        description: `Orchestrated: ${goal}`, status: 'running', priority: 'high',
        started_at: new Date().toISOString(),
      })

      const created = planned.map(p => {
        const agent = agents.find(a => a.role === p.agent_role) ?? agents[0]
        if (!agent) return null
        return createAgentTask({
          agent_id: agent.id, title: p.title, description: p.description, status: 'queued',
          priority: (['low', 'normal', 'high', 'urgent'].includes(p.priority) ? p.priority : 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          parent_task_id: parentTask.id,
        })
      }).filter(Boolean)

      return {
        success: true,
        message: `Deployed ${created.length} tasks across ${new Set(planned.map(p => p.agent_role)).size} agents. View them on the Agent Swarm board.`,
        tasks_created: created.length,
        agents_involved: [...new Set(planned.map(p => p.agent_role))],
      }
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
