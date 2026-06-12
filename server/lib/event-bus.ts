/**
 * Lightweight in-process event bus for cross-module triggers.
 * Emit events from routes; register handlers in the automation engine.
 */

export type EventType =
  | 'deal.won'
  | 'deal.created'
  | 'deal.stage_changed'
  | 'invoice.paid'
  | 'invoice.created'
  | 'appointment.booked'
  | 'appointment.completed'
  | 'contact.created'
  | 'form.submitted'
  | 'proposal.signed'
  | 'bill.paid'

export interface PlatformEvent {
  type: EventType
  brand: string
  entity_id: string
  entity_type: string
  data: Record<string, unknown>
  occurred_at: string
}

type EventHandler = (event: PlatformEvent) => Promise<void> | void

class EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map()

  on(type: EventType, handler: EventHandler): void {
    const existing = this.handlers.get(type) ?? []
    this.handlers.set(type, [...existing, handler])
  }

  async emit(event: PlatformEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? []
    await Promise.allSettled(handlers.map(h => h(event)))
    // Also append to activity store (best-effort, never throws)
    try {
      const { appendActivity } = await import('../stores/activity-store')
      appendActivity(event.brand, {
        type: event.type as import('../stores/activity-store').ActivityType,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        entity_name: String(event.data['name'] ?? event.data['title'] ?? event.entity_id),
        actor: String(event.data['actor'] ?? 'system'),
        message: buildEventMessage(event),
        metadata: event.data,
      })
    } catch { /* never let activity logging break the event */ }
  }
}

function buildEventMessage(event: PlatformEvent): string {
  switch (event.type) {
    case 'deal.won':              return `Deal "${event.data['title']}" marked as won`
    case 'deal.created':          return `New deal "${event.data['title']}" created`
    case 'deal.stage_changed':    return `Deal "${event.data['title']}" moved to ${event.data['new_stage']}`
    case 'invoice.paid':          return `Invoice ${event.data['invoice_number']} paid`
    case 'invoice.created':       return `Invoice ${event.data['invoice_number']} created`
    case 'appointment.booked':    return `Appointment "${event.data['title']}" scheduled`
    case 'appointment.completed': return `Appointment "${event.data['title']}" completed`
    case 'contact.created':       return `New contact "${event.data['name']}" added`
    case 'form.submitted':        return `Form "${event.data['form_name']}" submitted`
    case 'proposal.signed':       return `Proposal "${event.data['title']}" signed`
    case 'bill.paid':             return `Bill ${event.data['bill_number']} paid`
    default:                      return `${event.type} event`
  }
}

export const eventBus = new EventBus()
