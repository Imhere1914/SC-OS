/**
 * CSV Import Dialog — drag-drop or click to upload a CSV, map columns, preview, import.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

type Row = Record<string, string>

const FIELD_OPTIONS = ['name', 'email', 'phone', 'company', 'stage', 'tags', 'notes', '(skip)'] as const

function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    result.push(cur.trim())
    return result
  }
  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line)
    const row: Row = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
  return { headers, rows }
}

// Auto-detect mapping from header names
function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  headers.forEach(h => {
    const lower = h.toLowerCase().trim()
    if (lower.includes('name') && !lower.includes('company') && !lower.includes('last')) map[h] = 'name'
    else if (lower.includes('first') || lower === 'firstname') map[h] = 'name'
    else if (lower.includes('email')) map[h] = 'email'
    else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('cell')) map[h] = 'phone'
    else if (lower.includes('company') || lower.includes('org') || lower.includes('business')) map[h] = 'company'
    else if (lower.includes('stage') || lower.includes('status')) map[h] = 'stage'
    else if (lower.includes('tag')) map[h] = 'tags'
    else if (lower.includes('note')) map[h] = 'notes'
    else map[h] = '(skip)'
  })
  return map
}

async function importContacts(rows: Row[]): Promise<{ created: number; errors: Array<{ index: number; error: string }> }> {
  const res = await fetch('/api/contacts/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return res.json()
}

type Step = 'upload' | 'map' | 'preview' | 'done'

export function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      // Apply mapping: build a clean row per field
      const mapped = rows.map(raw => {
        const out: Record<string, string> = {}
        Object.entries(mapping).forEach(([col, field]) => {
          if (field === '(skip)') return
          // Merge multiple columns mapped to same field (e.g. first+last name)
          if (out[field]) out[field] += ' ' + (raw[col] ?? '')
          else out[field] = raw[col] ?? ''
        })
        return out
      }).filter(r => r.name?.trim())
      return importContacts(mapped)
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setResult({ created: data.created, errors: data.errors.length })
      setStep('done')
      toast(`Imported ${data.created} contacts`)
    },
    onError: () => toast('Import failed', { type: 'error' }),
  })

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      setHeaders(h)
      setRows(r)
      setMapping(autoMap(h))
      setStep('map')
    }
    reader.readAsText(file)
  }

  function reset() {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setResult(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--theme-text)]">Import Contacts from CSV</h2>
          <div className="flex gap-4 text-[10px] text-[var(--theme-muted)]">
            {(['upload','map','preview','done'] as Step[]).map((s, i) => (
              <span key={s} className={cn('flex items-center gap-1', s === step ? 'font-semibold text-[var(--theme-accent)]' : '')}>
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold',
                  s === step ? 'bg-[var(--theme-accent)] text-white' : 'bg-[var(--theme-hover)] text-[var(--theme-muted)]')}>
                  {i + 1}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-colors',
                drag ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)]' : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)]',
              )}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} size={28} className="mb-3 text-[var(--theme-accent)]" />
              <p className="text-sm font-medium text-[var(--theme-text)]">Drop CSV here or click to browse</p>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">First row must be headers. Name column required.</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div>
              <p className="mb-3 text-xs text-[var(--theme-muted)]">
                Map CSV columns to contact fields. <strong className="text-[var(--theme-text)]">{rows.length}</strong> rows detected.
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate rounded-md bg-[var(--theme-bg)] px-2 py-1 font-mono text-[10px] text-[var(--theme-muted)]">{h}</span>
                    <span className="text-xs text-[var(--theme-muted)]">→</span>
                    <select
                      value={mapping[h] ?? '(skip)'}
                      onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                      className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs text-[var(--theme-text)]"
                    >
                      {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <span className="w-24 shrink-0 truncate text-[10px] text-[var(--theme-muted)]">{rows[0]?.[h] ?? ''}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Back</button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!Object.values(mapping).includes('name')}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--theme-accent)' }}
                >
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <p className="mb-3 text-xs text-[var(--theme-muted)]">Preview — first 5 rows</p>
              <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-bg)]">
                      {Object.values(mapping).filter(f => f !== '(skip)').filter((v, i, a) => a.indexOf(v) === i).map(f => (
                        <th key={f} className="px-2 py-1.5 text-left font-semibold capitalize text-[var(--theme-muted)]">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((raw, ri) => {
                      const out: Record<string, string> = {}
                      Object.entries(mapping).forEach(([col, field]) => {
                        if (field === '(skip)') return
                        out[field] = (out[field] ? out[field] + ' ' : '') + (raw[col] ?? '')
                      })
                      return (
                        <tr key={ri} className="border-b border-[var(--theme-border)] last:border-0">
                          {Object.values(mapping).filter(f => f !== '(skip)').filter((v, i, a) => a.indexOf(v) === i).map(f => (
                            <td key={f} className="max-w-[100px] truncate px-2 py-1.5 text-[var(--theme-text)]">{out[f] ?? ''}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--theme-muted)]">{rows.length} total rows to import</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setStep('map')} className="rounded-lg px-3 py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Back</button>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                  className="rounded-lg px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  style={{ background: 'var(--theme-accent)' }}
                >
                  {importMutation.isPending ? 'Importing…' : `Import ${rows.length} contacts`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--theme-accent-soft)' }}>
                <HugeiconsIcon icon={Tick02Icon} size={24} className="text-[var(--theme-accent)]" />
              </div>
              <p className="text-base font-bold text-[var(--theme-text)]">{result.created} contacts imported</p>
              {result.errors > 0 && <p className="mt-1 text-xs text-[var(--theme-muted)]">{result.errors} rows skipped (missing name)</p>}
              <div className="mt-5 flex gap-2">
                <button onClick={() => { reset(); onClose() }} className="rounded-lg px-4 py-1.5 text-xs font-medium text-white" style={{ background: 'var(--theme-accent)' }}>Done</button>
                <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">Import another</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
