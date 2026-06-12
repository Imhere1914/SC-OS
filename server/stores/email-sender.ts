/**
 * Email sending adapter (Phase 4d).
 *
 * Sends campaign + transactional email through an ESP.
 * Preferred: Resend (RESEND_API_KEY). Fallback: AWS SES via SMTP-less HTTP
 * is non-trivial, so SES is left as a documented TODO; Resend covers the
 * common case with the simplest setup.
 *
 * Env vars:
 *   RESEND_API_KEY      — Resend API key
 *   CAMPAIGN_FROM_EMAIL — verified sender, e.g. "Holistic Functional Care <hello@holisticfunctionalcare.com>"
 *
 * Compliance note: campaign sends MUST include an unsubscribe mechanism to
 * comply with CAN-SPAM / CASL. The API route appends an unsubscribe footer.
 * For HFM (PHI), do NOT send clinical content over marketing email without
 * the HIPAA path in place.
 */

export type EmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

function getFrom(): string | null {
  return process.env.CAMPAIGN_FROM_EMAIL?.trim() || null
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!getFrom()
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = getFrom()

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        'Email not configured. Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL in the workspace .env.',
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    })
    const data = (await res.json()) as { id?: string; message?: string; name?: string }
    if (!res.ok) {
      return { ok: false, error: data.message ?? data.name ?? `Resend error ${res.status}` }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Render a simple transactional email (no unsubscribe footer).
 * Used for appointment confirmations, invoice notifications, etc.
 */
export function renderTransactionalHtml(opts: {
  brandName: string
  heading: string
  lines: string[]   // plain text lines; supports **bold**
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const { brandName, heading, lines, ctaLabel, ctaUrl } = opts
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const renderLine = (l: string) => escape(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const body = lines.map(l => `<p style="margin:0 0 12px;line-height:1.6">${renderLine(l)}</p>`).join('')
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin:24px 0"><a href="${ctaUrl}" style="background:#4f7ef8;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600">${ctaLabel}</a></p>`
    : ''
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:580px;margin:0 auto;padding:32px 24px">
<h2 style="margin:0 0 20px;font-size:20px">${escape(heading)}</h2>
${body}
${cta}
<hr style="border:0;border-top:1px solid #eee;margin:28px 0"/>
<p style="font-size:11px;color:#999;margin:0">${escape(brandName)}</p>
</body></html>`
}

/**
 * Convert simple markdown-ish body to minimal HTML + append an unsubscribe
 * footer (compliance). This is intentionally minimal; a richer renderer can
 * replace it later.
 */
export function renderCampaignHtml(
  body: string,
  opts: { brandName: string; unsubscribeUrl?: string },
): string {
  // Very small markdown subset: paragraphs, **bold**, line breaks.
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const paragraphs = withBold
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  const unsub = opts.unsubscribeUrl
    ? `<a href="${opts.unsubscribeUrl}" style="color:#888">unsubscribe</a>`
    : 'reply STOP to unsubscribe'

  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
${paragraphs}
<hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:12px;color:#888;margin:0">${opts.brandName} · ${unsub}</p>
</body></html>`
}
