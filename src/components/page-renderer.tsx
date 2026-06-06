import { useState } from 'react'
import type { Page } from '@/lib/pages-api'

/**
 * Public landing-page renderer (Phase 4f).
 *
 * Renders a published Page by template using inline styles so it displays
 * correctly outside the app shell (the /p/<slug> route is auth-bypassed).
 * The lead-capture template posts to the public /api/webchat ingest, so a
 * form submission creates a contact + conversation in the CRM.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderBody(body: string): string {
  const escaped = escapeHtml(body)
  const bold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return bold
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.7">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

const pageStyle = (accent: string): React.CSSProperties => ({
  fontFamily:
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  color: '#1a1a1a',
  minHeight: '100vh',
  margin: 0,
  // accent used by children
  ['--page-accent' as string]: accent,
})

function CtaButton({ text, url, accent }: { text: string; url: string; accent: string }) {
  if (!text) return null
  return (
    <a
      href={url || '#'}
      style={{
        display: 'inline-block',
        background: accent,
        color: '#fff',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: 16,
        padding: '14px 28px',
        borderRadius: 10,
        marginTop: 8,
      }}
    >
      {text}
    </a>
  )
}

function LeadCaptureForm({
  page,
  accent,
}: {
  page: Page
  accent: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() && !email.trim()) {
      setError('Please add a message or your email.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/webchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          message: message || `Lead from page: ${page.title}`,
        }),
      })
      if (!res.ok) throw new Error('submit failed')
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    marginBottom: 12,
    boxSizing: 'border-box',
  }

  if (done) {
    return (
      <div
        style={{
          background: '#f6f9f8',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          fontSize: 16,
        }}
      >
        {page.fields.success_message || 'Thanks — we’ll be in touch shortly!'}
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 460, margin: '0 auto' }}>
      <input
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />
      <textarea
        placeholder="How can we help?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      {error && (
        <p style={{ color: '#c0392b', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={sending}
        style={{
          width: '100%',
          background: accent,
          color: '#fff',
          border: 0,
          borderRadius: 10,
          padding: '14px',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Sending…' : page.fields.submit_text || 'Send'}
      </button>
    </form>
  )
}

export function PageRenderer({ page }: { page: Page }) {
  const accent = page.accent_color || '#4A9EA1'
  const f = page.fields

  if (page.template === 'hero-cta') {
    return (
      <div style={pageStyle(accent)}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '72px 24px',
            textAlign: 'center',
          }}
        >
          {f.image_url ? (
            <img
              src={f.image_url}
              alt=""
              style={{
                maxWidth: '100%',
                borderRadius: 16,
                marginBottom: 32,
              }}
            />
          ) : null}
          <h1 style={{ fontSize: 44, lineHeight: 1.15, margin: '0 0 20px', fontWeight: 800 }}>
            {f.headline || page.title}
          </h1>
          {f.subheadline && (
            <p style={{ fontSize: 19, color: '#555', lineHeight: 1.6, margin: '0 0 32px' }}>
              {f.subheadline}
            </p>
          )}
          <CtaButton text={f.cta_text} url={f.cta_url} accent={accent} />
          {f.footer_text && (
            <p style={{ fontSize: 13, color: '#999', marginTop: 56 }}>{f.footer_text}</p>
          )}
        </div>
      </div>
    )
  }

  if (page.template === 'lead-capture') {
    return (
      <div style={pageStyle(accent)}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
          <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '0 0 14px', fontWeight: 800, textAlign: 'center' }}>
            {f.headline || page.title}
          </h1>
          {f.subheadline && (
            <p style={{ fontSize: 17, color: '#555', lineHeight: 1.6, margin: '0 0 32px', textAlign: 'center' }}>
              {f.subheadline}
            </p>
          )}
          <LeadCaptureForm page={page} accent={accent} />
        </div>
      </div>
    )
  }

  // simple
  return (
    <div style={pageStyle(accent)}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '0 0 24px', fontWeight: 800 }}>
          {f.heading || page.title}
        </h1>
        <div
          style={{ fontSize: 17, color: '#333' }}
          dangerouslySetInnerHTML={{ __html: renderBody(f.body || '') }}
        />
        {f.cta_text && (
          <div style={{ marginTop: 24 }}>
            <CtaButton text={f.cta_text} url={f.cta_url} accent={accent} />
          </div>
        )}
      </div>
    </div>
  )
}
