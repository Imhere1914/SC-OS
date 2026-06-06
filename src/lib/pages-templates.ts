/**
 * Landing page template registry (Phase 4f).
 *
 * Defines the content fields for each template. Shared by the editor
 * (PagesScreen) and the public renderer (/p/<slug> route) so they never
 * drift. To add a template: add a key here + a render branch in
 * `page-renderer.tsx`.
 */

export type PageTemplate = 'hero-cta' | 'lead-capture' | 'simple'

export type FieldType = 'text' | 'textarea' | 'url'

export type TemplateField = {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

export type TemplateDef = {
  id: PageTemplate
  name: string
  description: string
  fields: TemplateField[]
  /** Sensible starter content */
  defaults: Record<string, string>
}

export const TEMPLATES: Record<PageTemplate, TemplateDef> = {
  'hero-cta': {
    id: 'hero-cta',
    name: 'Hero + CTA',
    description: 'Big headline, supporting text, and a call-to-action button.',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Transform your health, naturally' },
      { key: 'subheadline', label: 'Subheadline', type: 'textarea', placeholder: 'A short supporting sentence.' },
      { key: 'cta_text', label: 'Button text', type: 'text', placeholder: 'Book a consultation' },
      { key: 'cta_url', label: 'Button link', type: 'url', placeholder: 'https://…' },
      { key: 'image_url', label: 'Hero image URL (optional)', type: 'url' },
      { key: 'footer_text', label: 'Footer text', type: 'text' },
    ],
    defaults: {
      headline: 'Your headline here',
      subheadline: 'A short, compelling subheadline that explains the value.',
      cta_text: 'Get started',
      cta_url: '',
      footer_text: '',
    },
  },
  'lead-capture': {
    id: 'lead-capture',
    name: 'Lead Capture',
    description:
      'Headline + a name/email/message form that creates a contact + conversation.',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Get in touch' },
      { key: 'subheadline', label: 'Subheadline', type: 'textarea' },
      { key: 'submit_text', label: 'Submit button text', type: 'text', placeholder: 'Send' },
      { key: 'success_message', label: 'Success message', type: 'textarea', placeholder: 'Thanks — we’ll be in touch shortly!' },
    ],
    defaults: {
      headline: 'Get in touch',
      subheadline: 'Tell us a bit about what you’re looking for.',
      submit_text: 'Send',
      success_message: 'Thanks — we’ll be in touch shortly!',
    },
  },
  simple: {
    id: 'simple',
    name: 'Simple Text',
    description: 'A heading and body text — good for info / policy pages.',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body (supports **bold** and paragraphs)', type: 'textarea' },
      { key: 'cta_text', label: 'Button text (optional)', type: 'text' },
      { key: 'cta_url', label: 'Button link (optional)', type: 'url' },
    ],
    defaults: {
      heading: 'About us',
      body: 'Write your content here.\n\nUse **bold** and blank lines for paragraphs.',
      cta_text: '',
      cta_url: '',
    },
  },
}

export const TEMPLATE_LIST: TemplateDef[] = Object.values(TEMPLATES)

export function isPageTemplate(v: unknown): v is PageTemplate {
  return typeof v === 'string' && v in TEMPLATES
}
