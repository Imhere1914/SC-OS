import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Copy01Icon,
  BarChartIcon,
  Cancel01Icon,
  ArrowDown01Icon,
  DragDropVerticalIcon,
  CheckmarkCircle01Icon,
  PauseIcon,
  FileEditIcon,
  Download04Icon,
  Analytics01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/surveys')({ component: SurveysScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'nps' | 'rating' | 'text' | 'single_choice' | 'multiple_choice'

interface SurveyQuestion {
  id: string
  type: QuestionType
  text: string
  required: boolean
  options?: string[]
  min_label?: string
  max_label?: string
  scale?: number
}

interface SurveyRecord {
  id: string
  brand: string
  title: string
  description?: string
  questions: SurveyQuestion[]
  status: 'draft' | 'active' | 'closed'
  response_count: number
  created_at: string
  updated_at: string
}

interface SurveyResponse {
  id: string
  survey_id: string
  brand: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  answers: Record<string, string | number | string[]>
  nps_score?: number
  submitted_at: string
}

interface SurveyStats {
  response_count: number
  nps_score?: number
  nps_breakdown?: { promoters: number; passives: number; detractors: number }
  avg_ratings: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Design tokens (shared vocabulary with Payroll / Payments) ─────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const ghostBtnCls = 'flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]'

function GradientChip({ icon, size = 'md' }: { icon: typeof Add01Icon; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex ${size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'} shrink-0 items-center justify-center rounded-xl`}
      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
    >
      <HugeiconsIcon icon={icon} size={size === 'lg' ? 18 : 15} className="text-white" />
    </span>
  )
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#94a3b8', icon: FileEditIcon },
  active: { label: 'Active', color: '#10b981', icon: CheckmarkCircle01Icon },
  closed: { label: 'Closed', color: '#f97316', icon: PauseIcon },
}

function StatusBadge({ status }: { status: SurveyRecord['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${cfg.color} 12%, var(--theme-card))`,
        color: cfg.color,
        border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// NPS thresholds (display only): green >= 30, amber 0-29, red < 0
function npsHex(score: number): string {
  if (score >= 30) return '#10b981'
  if (score >= 0) return '#f59e0b'
  return '#ef4444'
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  nps: 'NPS (0–10)',
  rating: 'Rating',
  text: 'Text',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
}

function newQuestion(): SurveyQuestion {
  return { id: nanoid(), type: 'text', text: '', required: false }
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchSurveys(brand: string): Promise<SurveyRecord[]> {
  const res = await fetch(`/api/surveys?brand=${brand}`)
  if (!res.ok) throw new Error('Failed to load surveys')
  return res.json() as Promise<SurveyRecord[]>
}

async function fetchResponses(surveyId: string): Promise<SurveyResponse[]> {
  const res = await fetch(`/api/surveys/${surveyId}/responses`)
  if (!res.ok) throw new Error('Failed to load responses')
  return res.json() as Promise<SurveyResponse[]>
}

async function fetchStats(surveyId: string): Promise<SurveyStats> {
  const res = await fetch(`/api/surveys/${surveyId}/stats`)
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json() as Promise<SurveyStats>
}

// ── Question Builder ──────────────────────────────────────────────────────────

function QuestionRow({
  question,
  index,
  isLast,
  onChange,
  onDelete,
}: {
  question: SurveyQuestion
  index: number
  isLast: boolean
  onChange: (q: SurveyQuestion) => void
  onDelete: () => void
}) {
  const [optionsText, setOptionsText] = useState(question.options?.join(', ') ?? '')

  const update = (patch: Partial<SurveyQuestion>) => onChange({ ...question, ...patch })

  const handleTypeChange = (type: QuestionType) => {
    const updates: Partial<SurveyQuestion> = { type }
    if (type === 'nps') { updates.scale = 10; updates.min_label = 'Not at all likely'; updates.max_label = 'Extremely likely' }
    if (type === 'rating' && !question.scale) updates.scale = 5
    onChange({ ...question, ...updates })
  }

  const handleOptionsBlur = () => {
    const opts = optionsText.split(',').map(o => o.trim()).filter(Boolean)
    update({ options: opts })
  }

  return (
    <div className="flex gap-3">
      {/* Vertical stepper: numbered chip + connector */}
      <div className="flex shrink-0 flex-col items-center pt-3.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white tabular-nums"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          {index + 1}
        </span>
        {!isLast && (
          <span
            className="mt-1.5 w-px flex-1"
            style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 40%, transparent), transparent)' }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150">
        <div className="flex items-center gap-2">
          <span className="flex cursor-grab items-center justify-center text-[var(--theme-muted)]">
            <HugeiconsIcon icon={DragDropVerticalIcon} size={14} />
          </span>

          {/* Type selector */}
          <div className="relative">
            <select
              value={question.type}
              onChange={e => handleTypeChange(e.target.value as QuestionType)}
              className="appearance-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 pr-7 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            >
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <HugeiconsIcon icon={ArrowDown01Icon} size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
          </div>

          {/* Required toggle */}
          <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5">
            <span className="text-[11px] text-[var(--theme-muted)]">Required</span>
            <div
              onClick={() => update({ required: !question.required })}
              className={[
                'relative h-4 w-8 cursor-pointer rounded-full transition-colors',
                question.required ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
                  question.required ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </div>
          </label>

          <button
            onClick={onDelete}
            className="rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:bg-red-100 hover:text-red-500"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </button>
        </div>

        {/* Question text */}
        <input
          value={question.text}
          onChange={e => update({ text: e.target.value })}
          placeholder="Question text…"
          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />

        {/* Type-specific fields */}
        {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
          <input
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            onBlur={handleOptionsBlur}
            placeholder="Options (comma-separated): Yes, No, Maybe"
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        )}

        {question.type === 'rating' && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--theme-muted)]">Scale:</span>
            <div className="flex gap-1.5">
              {[5, 10].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update({ scale: s })}
                  className={[
                    'rounded-lg border px-3 py-1 text-[11px] font-medium transition-all duration-150',
                    (question.scale ?? 5) === s
                      ? 'border-transparent text-white'
                      : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:border-[var(--theme-accent)]',
                  ].join(' ')}
                  style={(question.scale ?? 5) === s ? { background: ACCENT_GRADIENT } : undefined}
                >
                  1–{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {question.type === 'nps' && (
          <div className="flex gap-3">
            <input
              value={question.min_label ?? ''}
              onChange={e => update({ min_label: e.target.value })}
              placeholder="Low label (e.g. Not at all likely)"
              className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
            <input
              value={question.max_label ?? ''}
              onChange={e => update({ max_label: e.target.value })}
              placeholder="High label (e.g. Extremely likely)"
              className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Create/Edit Modal ─────────────────────────────────────────────────────────

function SurveyModal({
  survey,
  brand: _brand,
  onClose,
  onSaved,
}: {
  survey: SurveyRecord | null
  brand: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(survey?.title ?? '')
  const [description, setDescription] = useState(survey?.description ?? '')
  const [status, setStatus] = useState<SurveyRecord['status']>(survey?.status ?? 'draft')
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    survey?.questions ?? []
  )
  const [saving, setSaving] = useState(false)

  const updateQuestion = (idx: number, q: SurveyQuestion) => {
    setQuestions(prev => prev.map((old, i) => (i === idx ? q : old)))
  }

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const addQuestion = () => {
    setQuestions(prev => [...prev, newQuestion()])
  }

  const save = async () => {
    if (!title.trim()) { toast('Title is required'); return }
    setSaving(true)
    try {
      const body = { title: title.trim(), description, status, questions }
      const url = survey ? `/api/surveys/${survey.id}` : '/api/surveys'
      const method = survey ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')
      toast(survey ? 'Survey updated' : 'Survey created')
      onSaved()
    } catch {
      toast('Failed to save survey')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <GradientChip icon={survey ? Edit02Icon : Add01Icon} />
            <div>
              <h2 className="text-[15px] font-bold text-[var(--theme-text)]">
                {survey ? 'Edit Survey' : 'Create Survey'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                <span className="tabular-nums">{questions.length}</span> question{questions.length !== 1 ? 's' : ''} · {STATUS_CONFIG[status].label}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Customer Satisfaction Survey"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-4 py-2.5 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief intro shown to respondents…"
              className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-4 py-2.5 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Status</label>
            <div className="flex w-fit gap-1 rounded-lg border border-[var(--theme-border)] p-1">
              {(['draft', 'active', 'closed'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className="rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-all duration-150"
                  style={
                    status === s
                      ? {
                          background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                          color: 'var(--theme-accent)',
                        }
                      : { color: 'var(--theme-muted)' }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                Questions ({questions.length})
              </label>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-all duration-150 hover:-translate-y-px"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Add01Icon} size={12} />
                Add Question
              </button>
            </div>
            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--theme-border)] py-8 text-center">
                <p className="text-[12px] text-[var(--theme-muted)]">No questions yet. Click "Add Question" to start.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    index={i}
                    isLast={i === questions.length - 1}
                    onChange={updated => updateQuestion(i, updated)}
                    onDelete={() => removeQuestion(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--theme-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : survey ? 'Save Changes' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────────────────────────

function ResultsModal({
  survey,
  onClose,
}: {
  survey: SurveyRecord
  onClose: () => void
}) {
  const { data: stats, isLoading: statsLoading } = useQuery<SurveyStats>({
    queryKey: ['survey-stats', survey.id],
    queryFn: () => fetchStats(survey.id),
  })

  const { data: responses = [], isLoading: responsesLoading } = useQuery<SurveyResponse[]>({
    queryKey: ['survey-responses', survey.id],
    queryFn: () => fetchResponses(survey.id),
  })

  const isLoading = statsLoading || responsesLoading

  const exportCsv = () => {
    if (!responses.length) { toast('No responses to export'); return }
    const questionIds = survey.questions.map(q => q.id)
    const headers = [
      'Response ID', 'Submitted At', 'Contact Name', 'Contact Email',
      ...survey.questions.map(q => q.text),
      'NPS Score',
    ]
    const rows = responses.map(r => [
      r.id,
      new Date(r.submitted_at).toLocaleString(),
      r.contact_name ?? '',
      r.contact_email ?? '',
      ...questionIds.map(qId => {
        const val = r.answers[qId]
        return Array.isArray(val) ? val.join('; ') : (val ?? '')
      }),
      r.nps_score ?? '',
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${survey.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Per-question analysis
  const questionAnalysis = useMemo(() => {
    return survey.questions.map(q => {
      if (q.type === 'nps' || q.type === 'rating') {
        const avg = stats?.avg_ratings[q.id]
        return { type: 'numeric', avg }
      }
      if (q.type === 'text') {
        const texts = responses
          .map(r => r.answers[q.id])
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 5)
        return { type: 'text', texts }
      }
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const counts: Record<string, number> = {}
        let total = 0
        for (const r of responses) {
          const val = r.answers[q.id]
          const vals = Array.isArray(val) ? val : (val ? [String(val)] : [])
          for (const v of vals) { counts[v] = (counts[v] ?? 0) + 1; total++ }
        }
        const breakdown = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({ label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
        return { type: 'choice', breakdown }
      }
      return { type: 'unknown' }
    })
  }, [survey, responses, stats])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <GradientChip icon={Analytics01Icon} />
            <div>
              <h2 className="text-[15px] font-bold text-[var(--theme-text)]">{survey.title}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Survey Results</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className={ghostBtnCls}>
              <HugeiconsIcon icon={Download04Icon} size={12} />
              Export CSV
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-[var(--theme-hover)] opacity-60" />
                <div className="h-24 rounded-xl bg-[var(--theme-hover)] opacity-60" />
              </div>
              <div className="h-20 rounded-xl bg-[var(--theme-hover)] opacity-60" />
              <div className="h-20 rounded-xl bg-[var(--theme-hover)] opacity-60" />
            </div>
          ) : (
            <>
              {/* Top stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] p-4 text-center"
                  style={{ backdropFilter: 'blur(10px)' }}
                >
                  <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: '#3b82f6' }} />
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Responses</p>
                  <p className="text-3xl font-bold tabular-nums text-[var(--theme-text)]">{stats?.response_count ?? 0}</p>
                </div>
                {stats?.nps_score !== undefined ? (
                  <div
                    className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] p-4 text-center"
                    style={{ backdropFilter: 'blur(10px)' }}
                  >
                    <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: npsHex(stats.nps_score) }} />
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">NPS Score</p>
                    <p className="text-3xl font-bold tabular-nums" style={{ color: npsHex(stats.nps_score) }}>
                      {stats.nps_score > 0 ? '+' : ''}{stats.nps_score}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-[var(--theme-border)] p-4 text-center">
                    <p className="text-[11px] text-[var(--theme-muted)]">No NPS question</p>
                  </div>
                )}
              </div>

              {/* NPS breakdown */}
              {stats?.nps_breakdown && (
                <div className="rounded-xl border border-[var(--theme-border)] p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">NPS Breakdown</p>
                  {(() => {
                    const bd = stats.nps_breakdown!
                    const total = bd.promoters + bd.passives + bd.detractors
                    const pPct = total > 0 ? Math.round((bd.promoters / total) * 100) : 0
                    const passivePct = total > 0 ? Math.round((bd.passives / total) * 100) : 0
                    const dPct = total > 0 ? Math.round((bd.detractors / total) * 100) : 0
                    return (
                      <>
                        <div className="mb-3 flex h-4 gap-0.5 overflow-hidden rounded-full">
                          {dPct > 0 && (
                            <div
                              className="transition-all"
                              style={{ width: `${dPct}%`, background: 'linear-gradient(90deg, #ef4444, color-mix(in srgb, #ef4444 70%, #f59e0b))' }}
                            />
                          )}
                          {passivePct > 0 && (
                            <div
                              className="transition-all"
                              style={{ width: `${passivePct}%`, background: 'linear-gradient(90deg, color-mix(in srgb, #f59e0b 80%, #ef4444), color-mix(in srgb, #f59e0b 80%, #10b981))' }}
                            />
                          )}
                          {pPct > 0 && (
                            <div
                              className="transition-all"
                              style={{ width: `${pPct}%`, background: 'linear-gradient(90deg, color-mix(in srgb, #10b981 70%, #f59e0b), #10b981)' }}
                            />
                          )}
                        </div>
                        <div className="flex gap-4 text-[11px] tabular-nums">
                          <span className="flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ef4444' }} />
                            Detractors {bd.detractors} ({dPct}%)
                          </span>
                          <span className="flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                            Passives {bd.passives} ({passivePct}%)
                          </span>
                          <span className="flex items-center gap-1.5" style={{ color: '#10b981' }}>
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10b981' }} />
                            Promoters {bd.promoters} ({pPct}%)
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Per-question */}
              {survey.questions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Per Question</p>
                  {survey.questions.map((q, i) => {
                    const analysis = questionAnalysis[i]
                    return (
                      <div key={q.id} className="rounded-xl border border-[var(--theme-border)] p-4 transition-all duration-150 hover:border-[color-mix(in_srgb,var(--theme-accent)_35%,var(--theme-border))]">
                        <p className="mb-2 flex items-start gap-2 text-[12px] font-medium text-[var(--theme-text)]">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                            style={{
                              background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                              color: 'var(--theme-accent)',
                            }}
                          >
                            {i + 1}
                          </span>
                          {q.text}
                        </p>
                        {analysis?.type === 'numeric' && (
                          <p className="text-[11px] text-[var(--theme-muted)]">
                            Avg: <span className="font-semibold tabular-nums text-[var(--theme-text)]">
                              {analysis.avg !== undefined ? analysis.avg : '—'}
                            </span>
                          </p>
                        )}
                        {analysis?.type === 'text' && (
                          <div className="space-y-1.5">
                            {(analysis.texts as string[]).length === 0 ? (
                              <p className="text-[11px] italic text-[var(--theme-muted)]">No responses yet</p>
                            ) : (
                              (analysis.texts as string[]).map((t, j) => (
                                <p key={j} className="rounded-lg bg-[var(--theme-hover)] px-3 py-2 text-[11px] text-[var(--theme-text)]">
                                  "{t}"
                                </p>
                              ))
                            )}
                          </div>
                        )}
                        {analysis?.type === 'choice' && (
                          <div className="space-y-1.5">
                            {(analysis.breakdown as { label: string; count: number; pct: number }[]).map(item => (
                              <div key={item.label} className="flex items-center gap-2">
                                <span className="w-32 shrink-0 truncate text-[11px] text-[var(--theme-text)]">{item.label}</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--theme-hover)]">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${item.pct}%`, background: ACCENT_GRADIENT }}
                                  />
                                </div>
                                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--theme-muted)]">
                                  {item.pct}% ({item.count})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function SurveysScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [editingSurvey, setEditingSurvey] = useState<SurveyRecord | 'new' | null>(null)
  const [viewingResults, setViewingResults] = useState<SurveyRecord | null>(null)

  const { data: surveys = [], isLoading } = useQuery<SurveyRecord[]>({
    queryKey: ['surveys', brand.id],
    queryFn: () => fetchSurveys(brand.id),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/surveys/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['surveys', brand.id] })
      toast('Survey deleted')
    },
    onError: () => toast('Failed to delete survey'),
  })

  const handleSaved = () => {
    setEditingSurvey(null)
    void qc.invalidateQueries({ queryKey: ['surveys', brand.id] })
  }

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/survey/${id}`
    void navigator.clipboard.writeText(url)
    toast('Link copied to clipboard')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <GradientChip icon={Analytics01Icon} size="lg" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Surveys & NPS</h1>
              <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">
                {surveys.length > 0 ? `${surveys.length} survey${surveys.length !== 1 ? 's' : ''} · ` : ''}
                Create surveys, collect feedback, and track NPS scores
              </p>
            </div>
          </div>
          <button onClick={() => setEditingSurvey('new')} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={15} />
            Create Survey
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-[var(--theme-card)] opacity-60" />
            ))}
          </div>
        ) : surveys.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--theme-border)] py-16 text-center">
            <span
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, transparent), color-mix(in srgb, #000 18%, transparent))' }}
            >
              <HugeiconsIcon icon={Analytics01Icon} size={26} className="text-[var(--theme-accent)]" />
            </span>
            <p className="mb-1 text-[14px] font-semibold text-[var(--theme-text)]">No surveys yet</p>
            <p className="mb-4 text-[12px] text-[var(--theme-muted)]">Create your first survey to start collecting feedback</p>
            <button onClick={() => setEditingSurvey('new')} className={primaryBtnCls} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={14} />
              Create Survey
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.map(survey => (
              <div
                key={survey.id}
                className="group rounded-2xl border border-[var(--theme-border)] p-5 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--theme-accent)_40%,var(--theme-border))] hover:shadow-md"
                style={{ background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-semibold text-[var(--theme-text)]">{survey.title}</h3>
                      <StatusBadge status={survey.status} />
                    </div>
                    {survey.description && (
                      <p className="mb-2 line-clamp-1 text-[12px] text-[var(--theme-muted)]">{survey.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-[var(--theme-muted)]">
                      {/* Response count metric chip */}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))',
                          color: '#3b82f6',
                          border: '1px solid color-mix(in srgb, #3b82f6 30%, transparent)',
                        }}
                      >
                        <HugeiconsIcon icon={BarChartIcon} size={10} />
                        <span className="tabular-nums">{survey.response_count}</span>
                        response{survey.response_count !== 1 ? 's' : ''}
                      </span>
                      <span className="tabular-nums">{survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>Created {fmtDate(survey.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setViewingResults(survey)}
                      title="View Results"
                      className={ghostBtnCls}
                    >
                      <HugeiconsIcon icon={BarChartIcon} size={13} />
                      Results
                    </button>
                    <button
                      onClick={() => copyLink(survey.id)}
                      title="Copy survey link"
                      className="rounded-lg border border-[var(--theme-border)] p-1.5 text-[var(--theme-muted)] opacity-70 transition-all duration-150 hover:bg-[var(--theme-hover)] group-hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={14} />
                    </button>
                    <button
                      onClick={() => setEditingSurvey(survey)}
                      title="Edit"
                      className="rounded-lg border border-[var(--theme-border)] p-1.5 text-[var(--theme-muted)] opacity-70 transition-all duration-150 hover:bg-[var(--theme-hover)] group-hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${survey.title}"?`)) {
                          deleteMutation.mutate(survey.id)
                        }
                      }}
                      title="Delete"
                      className="rounded-lg border border-[var(--theme-border)] p-1.5 text-[var(--theme-muted)] opacity-70 transition-all duration-150 hover:border-red-200 hover:bg-red-100 hover:text-red-500 group-hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {editingSurvey !== null && (
        <SurveyModal
          survey={editingSurvey === 'new' ? null : editingSurvey}
          brand={brand.id}
          onClose={() => setEditingSurvey(null)}
          onSaved={handleSaved}
        />
      )}
      {viewingResults && (
        <ResultsModal
          survey={viewingResults}
          onClose={() => setViewingResults(null)}
        />
      )}
    </div>
  )
}
