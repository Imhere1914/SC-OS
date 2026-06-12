import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
function dbPath(name: string) { mkdirSync(DATA_DIR, { recursive: true }); return join(DATA_DIR, name) }
function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file); if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function writeJson(file: string, data: unknown) {
  const tmp = dbPath(file) + '.tmp'; writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(file))
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TicketReply {
  id: string
  ticket_id: string
  author: string         // 'agent' or contact name
  is_internal: boolean   // internal note vs customer-visible reply
  body: string
  created_at: string
}

export interface TicketRecord {
  id: string
  brand: string
  subject: string
  body: string           // first message
  status: TicketStatus
  priority: TicketPriority
  contact_id?: string
  contact_name?: string
  contact_email?: string
  assignee?: string      // team member name
  tags?: string[]
  replies: TicketReply[]
  created_at: string
  updated_at: string
  resolved_at?: string
  first_response_at?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileName(brand: string) {
  return `tickets-${brand}.json`
}

function loadAll(brand: string): TicketRecord[] {
  return readJson<TicketRecord[]>(fileName(brand), [])
}

function saveAll(brand: string, tickets: TicketRecord[]) {
  writeJson(fileName(brand), tickets)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listTickets(
  brand: string,
  opts?: { status?: TicketStatus; priority?: TicketPriority; assignee?: string },
): TicketRecord[] {
  let tickets = loadAll(brand)
  if (opts?.status) tickets = tickets.filter(t => t.status === opts.status)
  if (opts?.priority) tickets = tickets.filter(t => t.priority === opts.priority)
  if (opts?.assignee) tickets = tickets.filter(t => t.assignee === opts.assignee)
  return tickets.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getTicket(brand: string, id: string): TicketRecord | null {
  return loadAll(brand).find(t => t.id === id) ?? null
}

export function createTicket(
  brand: string,
  data: Omit<TicketRecord, 'id' | 'brand' | 'replies' | 'created_at' | 'updated_at'>,
): TicketRecord {
  const tickets = loadAll(brand)
  const now = new Date().toISOString()
  const ticket: TicketRecord = {
    id: nanoid(),
    brand,
    replies: [],
    created_at: now,
    updated_at: now,
    ...data,
  }
  tickets.push(ticket)
  saveAll(brand, tickets)
  return ticket
}

export function updateTicket(
  brand: string,
  id: string,
  patch: Partial<Omit<TicketRecord, 'id' | 'brand' | 'replies' | 'created_at'>>,
): TicketRecord | null {
  const tickets = loadAll(brand)
  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return null
  const now = new Date().toISOString()
  const updated: TicketRecord = {
    ...tickets[idx],
    ...patch,
    updated_at: now,
  }
  tickets[idx] = updated
  saveAll(brand, tickets)
  return updated
}

export function addReply(
  brand: string,
  ticketId: string,
  reply: Omit<TicketReply, 'id' | 'ticket_id' | 'created_at'>,
): TicketRecord | null {
  const tickets = loadAll(brand)
  const idx = tickets.findIndex(t => t.id === ticketId)
  if (idx === -1) return null
  const now = new Date().toISOString()
  const newReply: TicketReply = {
    id: nanoid(),
    ticket_id: ticketId,
    created_at: now,
    ...reply,
  }
  const ticket = { ...tickets[idx] }
  ticket.replies = [...ticket.replies, newReply]
  ticket.updated_at = now

  // Set first_response_at on first agent (non-internal) reply
  if (!ticket.first_response_at && !reply.is_internal) {
    ticket.first_response_at = now
  }

  // Set resolved_at when status transitions to resolved/closed
  if (
    !ticket.resolved_at &&
    (ticket.status === 'resolved' || ticket.status === 'closed')
  ) {
    ticket.resolved_at = now
  }

  tickets[idx] = ticket
  saveAll(brand, tickets)
  return ticket
}

export function deleteTicket(brand: string, id: string): boolean {
  const tickets = loadAll(brand)
  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return false
  tickets.splice(idx, 1)
  saveAll(brand, tickets)
  return true
}

export function getTicketStats(brand: string): {
  open: number
  in_progress: number
  waiting: number
  resolved: number
  total: number
  urgent: number
} {
  const tickets = loadAll(brand)
  return {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: tickets.length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
  }
}
