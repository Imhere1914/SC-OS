import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  File01Icon,
  Image01Icon,
  Video01Icon,
  GoogleDocIcon,
  Pdf01Icon,
  FolderLibraryIcon,
  FolderOpenIcon,
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  Share04Icon,
  Copy01Icon,
  Cancel01Icon,
  GridViewIcon,
  ListViewIcon,
  Search01Icon,
  FolderAddIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/documents')({ component: DocumentsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentRecord {
  id: string
  brand: string
  name: string
  description?: string
  folder?: string
  mime_type: string
  size_bytes: number
  contact_id?: string
  contact_name?: string
  tags?: string[]
  shared: boolean
  share_token?: string
  storage_path: string
  created_at: string
  updated_at: string
  uploaded_by?: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchDocuments(brandId: string, folder?: string): Promise<DocumentRecord[]> {
  const params = new URLSearchParams({ brand: brandId })
  if (folder !== undefined && folder !== '__all__') params.set('folder', folder)
  const res = await fetch(`/api/documents?${params}`)
  if (!res.ok) throw new Error('Failed to fetch documents')
  const data = (await res.json()) as { documents: DocumentRecord[] }
  return data.documents
}

async function fetchFolders(brandId: string): Promise<string[]> {
  const res = await fetch(`/api/documents/folders?brand=${brandId}`)
  if (!res.ok) throw new Error('Failed to fetch folders')
  const data = (await res.json()) as { folders: string[] }
  return data.folders
}

async function deleteDocument(brandId: string, id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}?brand=${brandId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

async function shareDocument(brandId: string, id: string): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${id}/share?brand=${brandId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Share failed')
  const data = (await res.json()) as { document: DocumentRecord }
  return data.document
}

async function renameDocument(brandId: string, id: string, name: string, folder?: string): Promise<DocumentRecord> {
  const body: Record<string, string> = { name }
  if (folder !== undefined) body['folder'] = folder
  const res = await fetch(`/api/documents/${id}?brand=${brandId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Rename failed')
  const data = (await res.json()) as { document: DocumentRecord }
  return data.document
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

// Type-colored file identity: pdf red / image purple / video blue / sheet green / generic gray
function fileVisual(mime: string): { icon: typeof File01Icon; color: string } {
  if (mime === 'application/pdf') return { icon: Pdf01Icon, color: '#ef4444' }
  if (mime.startsWith('image/')) return { icon: Image01Icon, color: '#8b5cf6' }
  if (mime.startsWith('video/')) return { icon: Video01Icon, color: '#3b82f6' }
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return { icon: GoogleDocIcon, color: '#10b981' }
  if (mime.includes('word') || mime.includes('document') || mime.includes('text')) return { icon: GoogleDocIcon, color: '#0ea5e9' }
  return { icon: File01Icon, color: '#94a3b8' }
}

function FileTypeChip({ mime, size = 'sm' }: { mime: string; size?: 'sm' | 'lg' }) {
  const { icon, color } = fileVisual(mime)
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-8 w-8 rounded-lg'
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', box)}
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={icon} size={size === 'lg' ? 22 : 15} />
    </span>
  )
}

function SharedBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium', small ? 'text-[9px]' : 'text-[10px]')}
      style={{
        background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
        color: '#10b981',
        border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981' }} />
      Shared
    </span>
  )
}

// ── Upload progress tracker ───────────────────────────────────────────────────

interface UploadTask {
  taskId: string
  name: string
  progress: number
  done: boolean
  error?: string
}

// ── Share dialog ──────────────────────────────────────────────────────────────

function ShareDialog({ doc, onClose, brandId }: { doc: DocumentRecord; onClose: () => void; brandId: string }) {
  const qc = useQueryClient()
  const shareMut = useMutation({
    mutationFn: () => shareDocument(brandId, doc.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['documents', brandId] })
      toast('Share link generated')
      doc = updated
    },
  })

  const token = doc.share_token
  const shareUrl = token ? `${window.location.origin}/docs/${token}` : null

  const copy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => toast('Link copied!'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-[var(--theme-hover)]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Share04Icon} size={18} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--theme-text)]">Share Document</h3>
            <p className="text-[12px] text-[var(--theme-muted)] truncate max-w-[220px]">{doc.name}</p>
          </div>
        </div>

        {shareUrl ? (
          <div className="space-y-3">
            <p className="text-[12px] text-[var(--theme-muted)]">Anyone with this link can view and download the file.</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[11px] text-[var(--theme-text)] focus:outline-none"
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Copy01Icon} size={12} />
                Copy
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-[var(--theme-muted)]">Generate a public share link for this document.</p>
            <button
              onClick={() => shareMut.mutate()}
              disabled={shareMut.isPending}
              className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              {shareMut.isPending ? 'Generating…' : 'Generate Share Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Rename / Move dialog ──────────────────────────────────────────────────────

function RenameDialog({ doc, folders, onClose, brandId }: {
  doc: DocumentRecord
  folders: string[]
  onClose: () => void
  brandId: string
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(doc.name)
  const [folder, setFolder] = useState(doc.folder ?? '')

  const renameMut = useMutation({
    mutationFn: () => renameDocument(brandId, doc.id, name, folder || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', brandId] })
      qc.invalidateQueries({ queryKey: ['document-folders', brandId] })
      toast('Document updated')
      onClose()
    },
    onError: () => toast('Update failed', { type: 'error' }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 hover:bg-[var(--theme-hover)]">
          <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={18} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--theme-text)]">Rename / Move</h3>
            <p className="text-[12px] text-[var(--theme-muted)] truncate max-w-[220px]">{doc.name}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">File name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Folder</label>
            <input
              value={folder}
              onChange={e => setFolder(e.target.value)}
              list="folder-suggestions"
              placeholder="e.g. Contracts, Marketing/Assets"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
            <datalist id="folder-suggestions">
              {folders.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[12px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => renameMut.mutate()}
            disabled={!name.trim() || renameMut.isPending}
            className="rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            {renameMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Document card (grid) ──────────────────────────────────────────────────────

function DocCard({
  doc,
  onDelete,
  onShare,
  onRename,
  brandId,
}: {
  doc: DocumentRecord
  onDelete: () => void
  onShare: () => void
  onRename: () => void
  brandId: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="group relative rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      {/* File icon */}
      <div className="mb-3">
        <FileTypeChip mime={doc.mime_type} size="lg" />
      </div>

      {/* Name */}
      <p className="mb-1 truncate text-[13px] font-semibold text-[var(--theme-text)]" title={doc.name}>
        {doc.name}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
        <span className="text-[10px] text-[var(--theme-muted)]">{formatBytes(doc.size_bytes)}</span>
        <span className="text-[10px] text-[var(--theme-muted)]">·</span>
        <span className="text-[10px] text-[var(--theme-muted)]">{fmtDate(doc.created_at)}</span>
      </div>

      {/* Folder badge */}
      {doc.folder && (
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}
        >
          <HugeiconsIcon icon={FolderOpenIcon} size={10} />
          {doc.folder}
        </span>
      )}

      {/* Shared badge */}
      {doc.shared && (
        <span className="mt-2 ml-1 inline-flex">
          <SharedBadge />
        </span>
      )}

      {/* Context menu button */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="absolute right-2 top-2 rounded-lg p-1.5 opacity-0 transition-all duration-150 focus-visible:opacity-100 group-hover:opacity-100 hover:bg-[var(--theme-hover)]"
      >
        <span className="text-[var(--theme-muted)] text-[11px] font-bold leading-none">•••</span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-2 top-8 z-20 min-w-[140px] rounded-xl border py-1 shadow-2xl"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            <button
              onClick={() => { setMenuOpen(false); onRename() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
            >
              <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
              Rename / Move
            </button>
            <button
              onClick={() => { setMenuOpen(false); onShare() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
            >
              <HugeiconsIcon icon={Share04Icon} size={13} />
              Share link
            </button>
            <a
              href={`/api/documents/${doc.id}/download?brand=${brandId}`}
              download={doc.name}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
            >
              <HugeiconsIcon icon={File01Icon} size={13} />
              Download
            </a>
            <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border)' }} />
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-[var(--theme-hover)]"
            >
              <HugeiconsIcon icon={Delete02Icon} size={13} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Document row (list) ───────────────────────────────────────────────────────

function DocRow({
  doc,
  onDelete,
  onShare,
  onRename,
  brandId,
}: {
  doc: DocumentRecord
  onDelete: () => void
  onShare: () => void
  onRename: () => void
  brandId: string
}) {
  return (
    <tr className="group border-b hover:bg-[var(--theme-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileTypeChip mime={doc.mime_type} />
          <span className="text-[13px] font-medium text-[var(--theme-text)]">{doc.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[12px] text-[var(--theme-muted)]">
        {doc.folder
          ? <span className="inline-flex items-center gap-1"><HugeiconsIcon icon={FolderOpenIcon} size={11} />{doc.folder}</span>
          : <span className="text-[var(--theme-muted)] opacity-40">—</span>
        }
      </td>
      <td className="px-4 py-3 text-[12px] tabular-nums text-[var(--theme-muted)]">{formatBytes(doc.size_bytes)}</td>
      <td className="px-4 py-3 text-[12px] tabular-nums text-[var(--theme-muted)]">{fmtDate(doc.created_at)}</td>
      <td className="px-4 py-3">
        {doc.shared && <SharedBadge small />}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={onRename}
            className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
            title="Rename / Move"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-muted)]" />
          </button>
          <button
            onClick={onShare}
            className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
            title="Share"
          >
            <HugeiconsIcon icon={Share04Icon} size={13} className="text-[var(--theme-muted)]" />
          </button>
          <a
            href={`/api/documents/${doc.id}/download?brand=${brandId}`}
            download={doc.name}
            className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
            title="Download"
          >
            <HugeiconsIcon icon={File01Icon} size={13} className="text-[var(--theme-muted)]" />
          </a>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
            title="Delete"
          >
            <HugeiconsIcon icon={Delete02Icon} size={13} className="text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function DocumentsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()

  const [selectedFolder, setSelectedFolder] = useState<string>('__all__')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [uploads, setUploads] = useState<UploadTask[]>([])
  const [shareDoc, setShareDoc] = useState<DocumentRecord | null>(null)
  const [renameDoc, setRenameDoc] = useState<DocumentRecord | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', brand.id, selectedFolder],
    queryFn: () => fetchDocuments(brand.id, selectedFolder),
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['document-folders', brand.id],
    queryFn: () => fetchFolders(brand.id),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDocument(brand.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', brand.id] })
      toast('Document deleted')
    },
    onError: () => toast('Delete failed', { type: 'error' }),
  })

  const uploadFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      // Use a stable task id instead of array index to avoid stale-closure issues
      const taskId = `${Date.now()}-${Math.random()}`
      setUploads(prev => [...prev, { taskId, name: file.name, progress: 0, done: false }])

      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploads(prev => prev.map((u) => u.taskId === taskId ? { ...u, progress: pct } : u))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads(prev => prev.map((u) => u.taskId === taskId ? { ...u, progress: 100, done: true } : u))
          qc.invalidateQueries({ queryKey: ['documents', brand.id] })
          qc.invalidateQueries({ queryKey: ['document-folders', brand.id] })
          toast(`${file.name} uploaded`)
          setTimeout(() => {
            setUploads(prev => prev.filter((u) => u.taskId !== taskId))
          }, 2000)
        } else {
          setUploads(prev => prev.map((u) => u.taskId === taskId ? { ...u, error: 'Upload failed' } : u))
          toast(`Failed to upload ${file.name}`, { type: 'error' })
        }
      })

      xhr.addEventListener('error', () => {
        setUploads(prev => prev.map((u) => u.taskId === taskId ? { ...u, error: 'Network error' } : u))
        toast(`Network error uploading ${file.name}`, { type: 'error' })
      })

      xhr.open('POST', `/api/documents/upload?brand=${brand.id}`)
      xhr.send(formData)
    })
  }, [brand.id, qc])

  const filtered = docs.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full">
      {/* Left sidebar: folders */}
      <aside
        className="hidden w-48 shrink-0 flex-col border-r md:flex"
        style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-border)' }}
      >
        <div className="px-3 pt-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70 mb-2">
            Folders
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <button
            onClick={() => setSelectedFolder('__all__')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors',
              selectedFolder === '__all__'
                ? 'text-[var(--theme-accent)]'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
            )}
            style={selectedFolder === '__all__'
              ? { background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)', boxShadow: 'inset 2px 0 0 var(--theme-accent)' }
              : undefined}
          >
            <HugeiconsIcon icon={FolderLibraryIcon} size={14} />
            All Files
          </button>

          {folders.map(folder => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors',
                selectedFolder === folder
                  ? 'text-[var(--theme-accent)]'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
              )}
              style={selectedFolder === folder
                ? { background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)', boxShadow: 'inset 2px 0 0 var(--theme-accent)' }
                : undefined}
            >
              <HugeiconsIcon icon={FolderOpenIcon} size={14} />
              <span className="truncate">{folder}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 border-b px-6 py-4"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <HugeiconsIcon icon={FolderLibraryIcon} size={18} className="text-[var(--theme-accent)] shrink-0" />
            <h1 className="text-[16px] font-semibold text-[var(--theme-text)] truncate">
              {selectedFolder === '__all__' ? 'All Documents' : selectedFolder}
            </h1>
            <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
              {filtered.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative hidden sm:block">
            <HugeiconsIcon icon={Search01Icon} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-48 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-7 pr-3 text-[11px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--theme-border)' }}>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
            >
              <HugeiconsIcon icon={GridViewIcon} size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 transition-colors', viewMode === 'list' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
            >
              <HugeiconsIcon icon={ListViewIcon} size={13} />
            </button>
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Add01Icon} size={13} />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)}
          />
        </div>

        {/* Upload progress bars */}
        {uploads.length > 0 && (
          <div className="border-b px-6 py-3 space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="truncate text-[11px] text-[var(--theme-text)] max-w-[200px]">{u.name}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-hover)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${u.progress}%`,
                      background: u.error
                        ? 'linear-gradient(90deg, #ef4444, color-mix(in srgb, #ef4444 65%, #000))'
                        : u.done
                          ? 'linear-gradient(90deg, #10b981, color-mix(in srgb, #10b981 65%, #000))'
                          : ACCENT_GRADIENT.replace('135deg', '90deg'),
                    }}
                  />
                </div>
                <span className="w-8 text-right text-[10px] tabular-nums text-[var(--theme-muted)]">
                  {u.error ? 'Err' : u.done ? '✓' : `${u.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border"
                  style={{ borderColor: 'var(--theme-border)', background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-[var(--theme-muted)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))', color: 'var(--theme-accent)' }}>
                <HugeiconsIcon icon={FolderAddIcon} size={26} />
              </div>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">No documents yet</p>
              <p className="-mt-2 text-[12px]">Upload your first file to get started</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                Upload File
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  brandId={brand.id}
                  onDelete={() => {
                    if (confirm(`Delete "${doc.name}"?`)) deleteMut.mutate(doc.id)
                  }}
                  onShare={() => setShareDoc(doc)}
                  onRename={() => setRenameDoc(doc)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)' }}>
              <table className="w-full text-left">
                <thead style={{ background: 'var(--theme-hover)' }}>
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Name</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Folder</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Size</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Date</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <DocRow
                      key={doc.id}
                      doc={doc}
                      brandId={brand.id}
                      onDelete={() => {
                        if (confirm(`Delete "${doc.name}"?`)) deleteMut.mutate(doc.id)
                      }}
                      onShare={() => setShareDoc(doc)}
                      onRename={() => setRenameDoc(doc)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {shareDoc && (
        <ShareDialog
          doc={shareDoc}
          brandId={brand.id}
          onClose={() => setShareDoc(null)}
        />
      )}
      {renameDoc && (
        <RenameDialog
          doc={renameDoc}
          folders={folders}
          brandId={brand.id}
          onClose={() => setRenameDoc(null)}
        />
      )}
    </div>
  )
}
