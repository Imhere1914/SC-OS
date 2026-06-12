import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  File01Icon,
  Image01Icon,
  Video01Icon,
  GoogleDocIcon,
  Pdf01Icon,
  Download01Icon,
} from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/docs/$token')({ component: SharedDocPage })

interface DocumentRecord {
  id: string
  brand: string
  name: string
  description?: string
  folder?: string
  mime_type: string
  size_bytes: number
  shared: boolean
  share_token?: string
  created_at: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ mime, size = 48 }: { mime: string; size?: number }) {
  let icon = File01Icon
  if (mime.startsWith('image/')) icon = Image01Icon
  else if (mime.startsWith('video/')) icon = Video01Icon
  else if (mime === 'application/pdf') icon = Pdf01Icon
  else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) icon = GoogleDocIcon
  else if (mime.includes('word') || mime.includes('document') || mime.includes('text')) icon = GoogleDocIcon
  return <HugeiconsIcon icon={icon} size={size} />
}

function SharedDocPage() {
  const { token } = Route.useParams()
  const [doc, setDoc] = useState<DocumentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/documents/shared/${token}`)
      .then(async res => {
        if (!res.ok) throw new Error('Document not found or link expired')
        const data = (await res.json()) as { document: DocumentRecord }
        setDoc(data.document)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load document'))
      .finally(() => setLoading(false))
  }, [token])

  const downloadUrl = doc ? `/api/documents/${doc.id}/download?token=${token}` : '#'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--theme-bg)' }}>
        <p className="text-[14px] text-[var(--theme-muted)]">Loading…</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ background: 'var(--theme-bg)' }}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'var(--theme-card)', color: '#ef4444' }}
        >
          <HugeiconsIcon icon={File01Icon} size={32} />
        </div>
        <h1 className="text-[18px] font-semibold text-[var(--theme-text)]">Document not found</h1>
        <p className="text-[13px] text-[var(--theme-muted)]">{error ?? 'This link may have expired or been revoked.'}</p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: 'var(--theme-bg-grad)', backgroundAttachment: 'fixed' }}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-8 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        {/* File icon */}
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}
        >
          <FileTypeIcon mime={doc.mime_type} size={40} />
        </div>

        {/* File info */}
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-[18px] font-semibold text-[var(--theme-text)] break-all">{doc.name}</h1>
          {doc.description && (
            <p className="mb-2 text-[13px] text-[var(--theme-muted)]">{doc.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 text-[12px] text-[var(--theme-muted)]">
            <span className="rounded-full px-2 py-0.5 border" style={{ borderColor: 'var(--theme-border)' }}>
              {doc.mime_type.split('/')[1]?.toUpperCase() ?? 'FILE'}
            </span>
            <span>{formatBytes(doc.size_bytes)}</span>
          </div>
        </div>

        {/* Download button */}
        <a
          href={downloadUrl}
          download={doc.name}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--theme-accent)' }}
        >
          <HugeiconsIcon icon={Download01Icon} size={16} />
          Download
        </a>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-[var(--theme-muted)]">
          Shared securely via AI OS
        </p>
      </div>
    </div>
  )
}
