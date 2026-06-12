/**
 * Pre-built automation recipes — one-click import into the automation builder.
 */
import type { AutomationInput } from './automations-api'

export type AutomationRecipe = AutomationInput & {
  id: string
  emoji: string
  category: 'lead' | 'engagement' | 'operations' | 'health'
  description: string
}

// ─── Suggested automations (shown prominently at the top) ───────────────────
export const SUGGESTED_AUTOMATIONS: AutomationRecipe[] = [
  {
    id: 'suggest-deal-won-invoice',
    emoji: '🏆',
    category: 'operations',
    name: 'When deal is won → create invoice',
    description: 'Automatically notify the team to create an invoice when a deal closes.',
    trigger: 'deal_won',
    conditions: [],
    actions: [
      { type: 'create_task', task_title: 'Create invoice for {{deal_title}} ({{contact_name}})', task_priority: 'high' },
      { type: 'send_notification', message: 'Deal won! Create invoice for {{contact_name}} — deal: {{deal_title}}' },
    ],
  },
  {
    id: 'suggest-appointment-confirm',
    emoji: '📅',
    category: 'operations',
    name: 'When appointment is booked → send confirmation email',
    description: 'Instantly confirm appointments with a professional email to the contact.',
    trigger: 'new_appointment',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Your appointment is confirmed ✅',
        body: `Hi {{contact_name}},\n\nYour appointment has been confirmed. We look forward to seeing you!\n\nIf you need to reschedule or have questions, just reply to this email.\n\nSee you soon!`,
      },
    ],
  },
  {
    id: 'suggest-form-create-contact',
    emoji: '📋',
    category: 'engagement',
    name: 'When form is submitted → add to sequence',
    description: 'Automatically nurture leads the moment they submit a form.',
    trigger: 'form_submitted',
    conditions: [],
    actions: [
      { type: 'add_tag', tag: 'form-lead' },
      { type: 'send_notification', message: 'New form submission from {{contact_name}} — added to nurture sequence' },
    ],
  },
  {
    id: 'suggest-invoice-paid-thankyou',
    emoji: '💰',
    category: 'operations',
    name: 'When invoice is paid → send thank you email',
    description: 'Send a genuine thank-you the moment a payment comes in.',
    trigger: 'invoice_paid',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Thank you for your payment, {{contact_name}}!',
        body: `Hi {{contact_name}},\n\nThank you for your payment — it has been received and your account is now up to date.\n\nWe appreciate your business and look forward to continuing to work with you.\n\nWarm regards`,
      },
      { type: 'send_notification', message: 'Invoice paid by {{contact_name}} — thank you email sent' },
    ],
  },
]

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  // ── Lead workflows ──────────────────────────────────────────────────────
  {
    id: 'welcome-new-lead',
    emoji: '👋',
    category: 'lead',
    name: 'Welcome new lead',
    description: 'Send a warm welcome email the moment someone becomes a new contact.',
    trigger: 'new_contact',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Welcome, {{contact_name}}! 👋',
        body: `Hi {{contact_name}},\n\nWelcome! We're thrilled to connect with you.\n\nWe'll be in touch soon to learn more about how we can help.\n\nWarm regards`,
      },
      { type: 'send_notification', message: 'New lead welcomed: {{contact_name}}' },
    ],
  },
  {
    id: 'qualify-lead-tag',
    emoji: '🎯',
    category: 'lead',
    name: 'Tag and notify on new lead',
    description: 'Automatically tag new contacts as "new-lead" and alert your team.',
    trigger: 'new_contact',
    conditions: [],
    actions: [
      { type: 'add_tag', tag: 'new-lead' },
      { type: 'send_notification', message: 'New lead: {{contact_name}} ({{contact_email}})' },
    ],
  },

  // ── Engagement ──────────────────────────────────────────────────────────
  {
    id: 'customer-onboard',
    emoji: '🚀',
    category: 'engagement',
    name: 'Customer onboarding',
    description: 'When a contact becomes a customer, send an onboarding email and create a follow-up task.',
    trigger: 'contact_stage_changed',
    conditions: [{ field: 'contact_stage', operator: 'equals', value: 'customer' }],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: "You're in! Let's get started 🎉",
        body: `Hi {{contact_name}},\n\nWelcome aboard — we're so excited to have you as a customer!\n\nHere's what happens next:\n• We'll reach out within 24 hours\n• You'll receive a welcome package\n• Your dedicated account contact will introduce themselves\n\nAny questions? Just reply to this email.\n\nLooking forward to working with you!`,
      },
      {
        type: 'create_task',
        task_title: 'Onboarding call with {{contact_name}}',
        task_priority: 'high',
      },
      { type: 'add_tag', tag: 'customer' },
    ],
  },
  {
    id: 'form-lead-nurture',
    emoji: '📋',
    category: 'engagement',
    name: 'Form submission nurture',
    description: 'Follow up instantly when someone submits a form.',
    trigger: 'form_submitted',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: "Got it! We'll be in touch shortly",
        body: `Hi {{contact_name}},\n\nThank you for reaching out — we received your message and will follow up within 1 business day.\n\nIn the meantime, feel free to explore our website or reply to this email if you have an urgent question.\n\nTalk soon!`,
      },
      { type: 'add_tag', tag: 'form-lead' },
      { type: 'send_notification', message: 'Form submitted by {{contact_name}} — follow up soon!' },
    ],
  },
  {
    id: 'new-conversation-assign',
    emoji: '💬',
    category: 'engagement',
    name: 'New conversation alert',
    description: 'Get an instant notification whenever a new conversation starts.',
    trigger: 'new_conversation',
    conditions: [],
    actions: [
      { type: 'send_notification', message: 'New conversation from {{contact_name}} — reply promptly!' },
    ],
  },

  // ── Operations ──────────────────────────────────────────────────────────
  {
    id: 'appointment-confirm',
    emoji: '📅',
    category: 'operations',
    name: 'Appointment confirmation',
    description: 'Send a confirmation email and create a reminder task when an appointment is booked.',
    trigger: 'new_appointment',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Your appointment is confirmed ✅',
        body: `Hi {{contact_name}},\n\nYour appointment has been confirmed. We look forward to seeing you!\n\nIf you need to reschedule or have questions, just reply to this email.\n\nSee you soon!`,
      },
      {
        type: 'create_task',
        task_title: 'Prepare for appointment with {{contact_name}}',
        task_priority: 'medium',
      },
    ],
  },
  {
    id: 'lost-contact-winback',
    emoji: '🔄',
    category: 'operations',
    name: 'Win-back on lost stage',
    description: 'Flag contacts for re-engagement when they move to Lost.',
    trigger: 'contact_stage_changed',
    conditions: [{ field: 'contact_stage', operator: 'equals', value: 'lost' }],
    actions: [
      { type: 'add_tag', tag: 'win-back' },
      {
        type: 'create_task',
        task_title: 'Win-back outreach: {{contact_name}}',
        task_priority: 'low',
      },
    ],
  },

  // ── Deal workflows ──────────────────────────────────────────────────────
  {
    id: 'deal-won-celebrate',
    emoji: '🏆',
    category: 'operations',
    name: 'Deal won celebration + task',
    description: 'Notify the team and create a follow-up task when any deal closes.',
    trigger: 'deal_won',
    conditions: [],
    actions: [
      { type: 'send_notification', message: 'Deal won: {{deal_title}} for {{contact_name}}' },
      { type: 'create_task', task_title: 'Post-close follow-up with {{contact_name}}', task_priority: 'high' },
    ],
  },
  {
    id: 'deal-lost-winback',
    emoji: '🔄',
    category: 'operations',
    name: 'Deal lost → schedule win-back',
    description: 'Tag and create a future outreach task when a deal is lost.',
    trigger: 'deal_lost',
    conditions: [],
    actions: [
      { type: 'add_tag', tag: 'win-back' },
      { type: 'create_task', task_title: 'Win-back outreach: {{contact_name}}', task_priority: 'low' },
    ],
  },

  // ── Invoice workflows ────────────────────────────────────────────────────
  {
    id: 'invoice-paid-thankyou',
    emoji: '💰',
    category: 'operations',
    name: 'Invoice paid → thank you email',
    description: 'Automatically send a thank-you note when payment is received.',
    trigger: 'invoice_paid',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Thank you for your payment, {{contact_name}}!',
        body: `Hi {{contact_name}},\n\nThank you for your payment — it has been received and your account is now up to date.\n\nWe appreciate your business!\n\nWarm regards`,
      },
    ],
  },

  // ── Proposal workflows ───────────────────────────────────────────────────
  {
    id: 'proposal-signed-notify',
    emoji: '✍️',
    category: 'operations',
    name: 'Proposal signed → notify team + create task',
    description: 'Alert your team the moment a proposal is signed and kick off delivery.',
    trigger: 'proposal_signed',
    conditions: [],
    actions: [
      { type: 'send_notification', message: 'Proposal signed by {{contact_name}}! Start the project.' },
      { type: 'create_task', task_title: 'Kick off project for {{contact_name}}', task_priority: 'high' },
    ],
  },

  // ── Appointment completed ────────────────────────────────────────────────
  {
    id: 'appointment-completed-followup',
    emoji: '✅',
    category: 'operations',
    name: 'Appointment completed → follow-up task',
    description: 'Create a follow-up task automatically after every completed appointment.',
    trigger: 'appointment_completed',
    conditions: [],
    actions: [
      { type: 'create_task', task_title: 'Follow up with {{contact_name}} after appointment', task_priority: 'medium' },
      { type: 'send_notification', message: 'Appointment completed for {{contact_name}} — follow up created' },
    ],
  },

  // ── Health (HFM) ────────────────────────────────────────────────────────
  {
    id: 'hfm-patient-welcome',
    emoji: '🌿',
    category: 'health',
    name: 'Patient welcome (HFM)',
    description: 'Send a warm welcome to new patients with intake information.',
    trigger: 'new_contact',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Welcome to your care journey, {{contact_name}}',
        body: `Dear {{contact_name}},\n\nWelcome! We're honoured to be a part of your health journey.\n\nYour initial consultation details will be sent separately. In the meantime, please complete any intake forms we've sent.\n\nIf you have questions, don't hesitate to reach out.\n\nIn health,\nThe Care Team`,
      },
      { type: 'add_tag', tag: 'new-patient' },
      { type: 'send_notification', message: 'New patient registered: {{contact_name}}' },
    ],
  },
  {
    id: 'hfm-appointment-reminder',
    emoji: '💊',
    category: 'health',
    name: 'Patient appointment reminder (HFM)',
    description: 'Automatically remind patients before their upcoming appointment.',
    trigger: 'new_appointment',
    conditions: [],
    actions: [
      {
        type: 'send_email',
        to: 'contact',
        subject: 'Reminder: Your upcoming appointment',
        body: `Dear {{contact_name}},\n\nThis is a friendly reminder about your upcoming appointment.\n\nPlease arrive 10 minutes early and bring any relevant health documents.\n\nIf you need to reschedule, please contact us as soon as possible.\n\nSee you soon!`,
      },
      { type: 'send_notification', message: 'Appointment confirmed for patient {{contact_name}}' },
    ],
  },
]

export const RECIPE_CATEGORIES: Record<AutomationRecipe['category'], { label: string; emoji: string }> = {
  lead: { label: 'Lead workflows', emoji: '🎯' },
  engagement: { label: 'Engagement', emoji: '💬' },
  operations: { label: 'Operations', emoji: '⚙️' },
  health: { label: 'Health & Care (HFM)', emoji: '🌿' },
}
