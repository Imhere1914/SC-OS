import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  Edit01Icon,
  EyeIcon,
  File01Icon,
  FileAudioIcon,
  GlobalIcon,
  PencilEdit02Icon,
  Quiz03Icon,
  SchoolIcon,
  Tag01Icon,
  UserGroupIcon,
  VideoIcon,
} from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'
import { useNavigate } from '@tanstack/react-router'

// ── Types ─────────────────────────────────────────────────────────────────────

type LessonType = 'text' | 'video' | 'audio' | 'pdf' | 'quiz'
type ModuleStatus = 'draft' | 'published' | 'archived'

interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'true_false' | 'short_answer'
  options?: string[]
  correct_answer?: string
  explanation?: string
}

interface Lesson {
  id: string
  title: string
  type: LessonType
  content_html?: string
  video_url?: string
  audio_url?: string
  pdf_url?: string
  duration_minutes?: number
  quiz_questions?: QuizQuestion[]
  order: number
  is_preview: boolean
}

interface TrainingModule {
  id: string
  brand: string
  title: string
  slug: string
  description: string
  category: string
  thumbnail_url?: string
  instructor_name?: string
  instructor_bio?: string
  status: ModuleStatus
  is_free: boolean
  price_cents?: number
  lessons: Lesson[]
  tags: string[]
  total_duration_minutes: number
  enrolled_count: number
  share_token: string
  created_at: string
  updated_at: string
}

interface Enrollment {
  id: string
  brand: string
  module_id: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  progress: number
  completed_lessons: string[]
  started_at: string
  completed_at?: string
  last_accessed_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Holistic Foundations',
  'Mind-Body Connection',
  'Functional Nutrition',
  'Energy Medicine',
  'Metaphysical Wellness',
]

const LESSON_TYPE_ICONS: Record<LessonType, typeof BookOpen01Icon> = {
  text: BookOpen01Icon,
  video: VideoIcon,
  audio: FileAudioIcon,
  pdf: File01Icon,
  quiz: Quiz03Icon,
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Holistic Foundations': 'linear-gradient(135deg, #a3843b 0%, #c4a04e 100%)',
  'Mind-Body Connection': 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  'Functional Nutrition': 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'Energy Medicine': 'linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)',
  'Metaphysical Wellness': 'linear-gradient(135deg, #ec4899 0%, #f9a8d4 100%)',
}

const LESSON_TYPE_COLORS: Record<LessonType, string> = {
  text: '#0ea5e9',
  video: '#3b82f6',
  audio: '#8b5cf6',
  pdf: '#ef4444',
  quiz: '#f59e0b',
}

const MODULE_STATUS_COLORS: Record<ModuleStatus, string> = {
  draft: '#94a3b8',
  published: '#10b981',
  archived: '#f59e0b',
}

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchModules(brand: string, category: string): Promise<TrainingModule[]> {
  const params = new URLSearchParams({ brand })
  if (category !== 'All') params.set('category', category)
  const res = await fetch(`/api/training/modules?${params}`)
  const data = await res.json() as { modules?: TrainingModule[] }
  return data.modules ?? []
}

async function fetchEnrollments(brand: string): Promise<Enrollment[]> {
  const res = await fetch(`/api/training/enrollments?brand=${brand}`)
  const data = await res.json() as { enrollments?: Enrollment[] }
  return data.enrollments ?? []
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string
  value: string | number
  color: string
  icon: typeof BookOpen01Icon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
      </div>
    </div>
  )
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Module Form Modal ─────────────────────────────────────────────────────────

function ModuleModal({
  initial,
  brand,
  onSave,
  onClose,
}: {
  initial?: TrainingModule | null
  brand: string
  onSave: (data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'Holistic Foundations')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [instructorName, setInstructorName] = useState(initial?.instructor_name ?? '')
  const [instructorBio, setInstructorBio] = useState(initial?.instructor_bio ?? '')
  const [isFree, setIsFree] = useState(initial?.is_free ?? true)
  const [priceCents, setPriceCents] = useState(initial?.price_cents ? String(initial.price_cents / 100) : '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [autoSlug, setAutoSlug] = useState(!initial)

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (autoSlug) setSlug(slugify(v))
  }

  const handleSubmit = () => {
    if (!title.trim()) { toast('Title is required', { type: 'error' }); return }
    onSave({
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      category,
      description: description.trim(),
      instructor_name: instructorName.trim() || undefined,
      instructor_bio: instructorBio.trim() || undefined,
      is_free: isFree,
      price_cents: !isFree && priceCents ? Math.round(parseFloat(priceCents) * 100) : undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      brand,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-xl overflow-y-auto rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)', maxHeight: '90vh' }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold leading-tight text-[var(--theme-text)]">
              {initial ? 'Edit Module' : 'New Training Module'}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {initial ? initial.title : 'Build a course for your community'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Title">
            <input value={title} onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. Introduction to Holistic Health"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </Field>
          <Field label="Slug (URL)">
            <input value={slug} onChange={e => { setSlug(e.target.value); setAutoSlug(false) }}
              placeholder="intro-to-holistic-health"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </Field>
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Brief overview of what students will learn..."
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }} />
          </Field>
          <Field label="Instructor Name">
            <input value={instructorName} onChange={e => setInstructorName(e.target.value)}
              placeholder="e.g. Dr. Sarah Jones"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }} />
          </Field>
          <Field label="Instructor Bio">
            <textarea value={instructorBio} onChange={e => setInstructorBio(e.target.value)}
              rows={2} placeholder="Brief bio..."
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }} />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--theme-text)]">
              <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="rounded" />
              Free course
            </label>
            {!isFree && (
              <input value={priceCents} onChange={e => setPriceCents(e.target.value)}
                placeholder="Price (USD)" type="number" min="0" step="0.01"
                className="flex-1 rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }} />
            )}
          </div>
          <Field label="Tags (comma-separated)">
            <input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="holistic, wellness, beginner"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
            style={{ borderColor: 'var(--theme-border)' }}>
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
            {initial ? 'Save Changes' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lesson Form ───────────────────────────────────────────────────────────────

function LessonForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Lesson>
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<LessonType>(initial?.type ?? 'text')
  const [contentHtml, setContentHtml] = useState(initial?.content_html ?? '')
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? '')
  const [audioUrl, setAudioUrl] = useState(initial?.audio_url ?? '')
  const [duration, setDuration] = useState(initial?.duration_minutes ? String(initial.duration_minutes) : '')
  const [isPreview, setIsPreview] = useState(initial?.is_preview ?? false)
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial?.quiz_questions ?? [])

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      question: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
    }])
  }

  const removeQuestion = (idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx))

  const updateQuestion = (idx: number, field: keyof QuizQuestion, value: string | string[]) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const handleSave = () => {
    if (!title.trim()) { toast('Lesson title is required', { type: 'error' }); return }
    onSave({
      title: title.trim(),
      type,
      content_html: type === 'text' ? contentHtml : undefined,
      video_url: type === 'video' ? videoUrl.trim() : undefined,
      audio_url: type === 'audio' ? audioUrl.trim() : undefined,
      duration_minutes: duration ? parseInt(duration) : undefined,
      quiz_questions: type === 'quiz' ? questions : undefined,
      is_preview: isPreview,
    })
  }

  const inputCls = "w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
  const inputStyle = { borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Title">
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. What Is Holistic Health?"
                className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <div className="w-28">
            <Field label="Type">
              <select value={type} onChange={e => setType(e.target.value as LessonType)}
                className={inputCls} style={inputStyle}>
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="pdf">PDF</option>
                <option value="quiz">Quiz</option>
              </select>
            </Field>
          </div>
          <div className="w-20">
            <Field label="Mins">
              <input value={duration} onChange={e => setDuration(e.target.value)}
                type="number" min="0" placeholder="10"
                className={inputCls} style={inputStyle} />
            </Field>
          </div>
        </div>

        {type === 'text' && (
          <Field label="Content (HTML)">
            <textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)}
              rows={6} placeholder="<h2>Lesson content here…</h2><p>…</p>"
              className="w-full resize-y rounded-xl border px-3 py-2 font-mono text-[12px] text-[var(--theme-text)] outline-none"
              style={inputStyle} />
          </Field>
        )}
        {type === 'video' && (
          <Field label="Video Embed URL">
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/embed/..."
              className={inputCls} style={inputStyle} />
          </Field>
        )}
        {type === 'audio' && (
          <Field label="Audio URL">
            <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls} style={inputStyle} />
          </Field>
        )}
        {type === 'quiz' && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">Questions</label>
            {questions.map((q, qi) => (
              <div key={q.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white"
                    style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
                  >
                    {qi + 1}
                  </span>
                  <div className="flex flex-1 flex-col gap-2">
                    <input value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)}
                      placeholder={`Question ${qi + 1}`} className={inputCls} style={inputStyle} />
                    <select value={q.type} onChange={e => updateQuestion(qi, 'type', e.target.value)}
                      className={inputCls} style={inputStyle}>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                    {q.type === 'multiple_choice' && (q.options ?? []).map((opt, oi) => (
                      <input key={oi} value={opt}
                        onChange={e => {
                          const opts = [...(q.options ?? [])]
                          opts[oi] = e.target.value
                          updateQuestion(qi, 'options', opts)
                        }}
                        placeholder={`Option ${oi + 1}`}
                        className={inputCls} style={inputStyle} />
                    ))}
                    {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                      <input value={q.correct_answer ?? ''} onChange={e => updateQuestion(qi, 'correct_answer', e.target.value)}
                        placeholder="Correct answer" className={inputCls} style={inputStyle} />
                    )}
                  </div>
                  <button onClick={() => removeQuestion(qi)}
                    className="mt-1 rounded-lg p-1 text-red-400 transition-all duration-150 hover:bg-[color-mix(in_srgb,#ef4444_12%,transparent)] hover:text-red-500">
                    <HugeiconsIcon icon={Delete01Icon} size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addQuestion}
              className="rounded-xl border px-3 py-1.5 text-[12px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
              style={{ borderColor: 'var(--theme-border)' }}>
              + Add Question
            </button>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--theme-text)]">
          <input type="checkbox" checked={isPreview} onChange={e => setIsPreview(e.target.checked)} className="rounded" />
          Available as preview (no enrollment required)
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-xl border px-3 py-1.5 text-[12px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
            style={{ borderColor: 'var(--theme-border)' }}>
            Cancel
          </button>
          <button onClick={handleSave}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
            Save Lesson
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lessons Panel ─────────────────────────────────────────────────────────────

function LessonsPanel({
  module,
  brand,
  onClose,
}: {
  module: TrainingModule
  brand: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [addingLesson, setAddingLesson] = useState(false)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/training/modules/${module.id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast('Lesson added')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
      setAddingLesson(false)
    },
    onError: () => toast('Failed to add lesson', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ lessonId, data }: { lessonId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/training/modules/${module.id}/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast('Lesson updated')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
      setEditingLessonId(null)
    },
    onError: () => toast('Failed to update lesson', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      await fetch(`/api/training/modules/${module.id}/lessons/${lessonId}?brand=${brand}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      toast('Lesson removed')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
    },
    onError: () => toast('Failed to remove lesson', { type: 'error' }),
  })

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await fetch(`/api/training/modules/${module.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_ids: orderedIds, brand }),
      })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['training-modules'] }),
  })

  const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order)

  const moveLesson = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sortedLessons.length) return
    const ids = sortedLessons.map(l => l.id)
    const [moved] = ids.splice(idx, 1)
    ids.splice(newIdx, 0, moved)
    reorderMutation.mutate(ids)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden shadow-2xl"
        style={{ background: 'var(--theme-card-solid)', borderLeft: '1px solid var(--theme-border)' }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={BookOpen01Icon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">Lessons</h2>
              <p className="text-[12px] text-[var(--theme-muted)]">{module.title}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            {sortedLessons.map((lesson, idx) => (
              <div key={lesson.id}>
                {editingLessonId === lesson.id ? (
                  <LessonForm
                    initial={lesson}
                    onSave={data => updateMutation.mutate({ lessonId: lesson.id, data })}
                    onCancel={() => setEditingLessonId(null)}
                  />
                ) : (
                  <div
                    className="flex items-center gap-3 rounded-xl border p-3 transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
                    style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveLesson(idx, -1)} disabled={idx === 0}
                        className="rounded-md border border-transparent p-0.5 text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-border)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] disabled:opacity-30 disabled:hover:border-transparent disabled:hover:bg-transparent">
                        <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                      </button>
                      <button onClick={() => moveLesson(idx, 1)} disabled={idx === sortedLessons.length - 1}
                        className="rounded-md border border-transparent p-0.5 text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-border)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] disabled:opacity-30 disabled:hover:border-transparent disabled:hover:bg-transparent">
                        <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                      </button>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${LESSON_TYPE_COLORS[lesson.type]} 12%, var(--theme-card))`,
                        color: LESSON_TYPE_COLORS[lesson.type],
                        border: `1px solid color-mix(in srgb, ${LESSON_TYPE_COLORS[lesson.type]} 30%, transparent)`,
                      }}>
                      <HugeiconsIcon icon={LESSON_TYPE_ICONS[lesson.type]} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[var(--theme-text)]">{lesson.title}</div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--theme-muted)]">
                        <span className="capitalize">{lesson.type}</span>
                        {lesson.duration_minutes != null && <span>· {lesson.duration_minutes}m</span>}
                        {lesson.is_preview && (
                          <span className="rounded px-1 text-[10px]"
                            style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
                            Preview
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingLessonId(lesson.id)}
                        className="rounded p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
                        <HugeiconsIcon icon={Edit01Icon} size={13} />
                      </button>
                      <button onClick={() => { if (confirm('Remove this lesson?')) deleteMutation.mutate(lesson.id) }}
                        className="rounded p-1 text-[var(--theme-muted)] hover:bg-red-50 hover:text-red-500">
                        <HugeiconsIcon icon={Delete01Icon} size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {sortedLessons.length === 0 && !addingLesson && (
              <div className="py-8 text-center text-[13px] text-[var(--theme-muted)]">
                No lessons yet. Add your first lesson below.
              </div>
            )}

            {addingLesson ? (
              <LessonForm
                onSave={data => addMutation.mutate(data)}
                onCancel={() => setAddingLesson(false)}
              />
            ) : (
              <button onClick={() => setAddingLesson(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                style={{ borderColor: 'var(--theme-border)', borderStyle: 'dashed' }}>
                <HugeiconsIcon icon={Add01Icon} size={14} />
                Add Lesson
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Module Card ───────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  brand,
  onEdit,
  onLessons,
}: {
  module: TrainingModule
  brand: string
  onEdit: () => void
  onLessons: () => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/training/modules/${module.id}/publish?brand=${brand}`, { method: 'POST' })
      return res.json()
    },
    onSuccess: () => {
      toast('Module published')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
    },
    onError: () => toast('Failed to publish', { type: 'error' }),
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/training/modules/${module.id}/archive?brand=${brand}`, { method: 'POST' })
      return res.json()
    },
    onSuccess: () => {
      toast('Module archived')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
    },
    onError: () => toast('Failed to archive', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/training/modules/${module.id}?brand=${brand}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      toast('Module deleted')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
    },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const gradient = CATEGORY_GRADIENTS[module.category] ?? 'linear-gradient(135deg, #a3843b 0%, #c4a04e 100%)'
  const statusColor = MODULE_STATUS_COLORS[module.status]

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div className="relative flex h-32 items-center justify-center" style={{ background: gradient }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.22), transparent 55%)' }}
        />
        <HugeiconsIcon icon={SchoolIcon} size={40} className="relative text-white/60" />
        <span
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: `color-mix(in srgb, ${statusColor} 16%, var(--theme-card))`,
            color: statusColor,
            border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
          {module.status}
        </span>
        <div className="absolute left-2 top-2 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {module.category}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-1 text-[14px] font-semibold leading-tight text-[var(--theme-text)]">
          {module.title}
        </h3>
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-[var(--theme-muted)]">
          {module.description}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-muted)]">
          {[
            { icon: BookOpen01Icon, text: `${module.lessons.length} lessons` },
            { icon: Clock01Icon, text: formatDuration(module.total_duration_minutes) },
            { icon: UserGroupIcon, text: String(module.enrolled_count) },
          ].map(chip => (
            <span key={chip.text}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
              <HugeiconsIcon icon={chip.icon} size={10} />
              {chip.text}
            </span>
          ))}
          {module.is_free ? (
            <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981', border: '1px solid color-mix(in srgb, #10b981 30%, transparent)' }}>
              Free
            </span>
          ) : (
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-[var(--theme-text)]">
              ${((module.price_cents ?? 0) / 100).toFixed(2)}
            </span>
          )}
        </div>
        {module.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {module.tags.slice(0, 3).map(tag => (
              <span key={tag} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: 'var(--theme-hover)', color: 'var(--theme-muted)' }}>
                <HugeiconsIcon icon={Tag01Icon} size={9} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t px-4 py-2" style={{ borderColor: 'var(--theme-border)' }}>
        <button onClick={onEdit}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
          <HugeiconsIcon icon={PencilEdit02Icon} size={12} />
          Edit
        </button>
        <button onClick={onLessons}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
          <HugeiconsIcon icon={BookOpen01Icon} size={12} />
          Lessons
        </button>
        <button onClick={() => void navigate({ to: '/learn/$slug', params: { slug: module.slug } })}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]">
          <HugeiconsIcon icon={EyeIcon} size={12} />
          Preview
        </button>
        {module.status !== 'published' && (
          <button onClick={() => publishMutation.mutate()}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-green-600 hover:bg-green-50">
            <HugeiconsIcon icon={GlobalIcon} size={12} />
            Publish
          </button>
        )}
        {module.status === 'published' && (
          <button onClick={() => archiveMutation.mutate()}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">
            Archive
          </button>
        )}
        <button onClick={() => { if (confirm('Delete this module?')) deleteMutation.mutate() }}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-400 hover:bg-red-50 hover:text-red-600">
          <HugeiconsIcon icon={Delete01Icon} size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function TrainingScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'modules' | 'enrollments'>('modules')
  const [categoryFilter, setCategoryFilter] = useState('All')
  // undefined = modal closed, null = new module, TrainingModule = editing
  const [editingModule, setEditingModule] = useState<TrainingModule | null | undefined>(undefined)
  const [lessonsModule, setLessonsModule] = useState<TrainingModule | null>(null)

  const modulesQuery = useQuery({
    queryKey: ['training-modules', brand.id, categoryFilter],
    queryFn: () => fetchModules(brand.id, categoryFilter),
  })

  const enrollmentsQuery = useQuery({
    queryKey: ['training-enrollments', brand.id],
    queryFn: () => fetchEnrollments(brand.id),
    enabled: activeTab === 'enrollments',
  })

  const modules = modulesQuery.data ?? []
  const enrollments = enrollmentsQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/training/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brand.id }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast('Module created')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
      setEditingModule(undefined)
    },
    onError: () => toast('Failed to create module', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/training/modules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brand.id }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast('Module updated')
      void qc.invalidateQueries({ queryKey: ['training-modules'] })
      setEditingModule(undefined)
    },
    onError: () => toast('Failed to update module', { type: 'error' }),
  })

  const handleSaveModule = (data: Record<string, unknown>) => {
    if (editingModule?.id) {
      updateMutation.mutate({ id: editingModule.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const published = modules.filter(m => m.status === 'published').length
  const totalEnrolled = modules.reduce((s, m) => s + m.enrolled_count, 0)
  const completed = enrollments.filter(e => e.completed_at).length
  const completionRate = enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0

  return (
    <ScreenShell
      icon={BookOpen01Icon}
      title="Training Modules"
      count={modules.length}
      action={
        <button
          onClick={() => setEditingModule(null)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Module
        </button>
      }
    >
      {/* Stats strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Modules" value={modules.length} icon={BookOpen01Icon} color="#3b82f6" />
        <StatCard label="Published" value={published} icon={GlobalIcon} color="#10b981" />
        <StatCard label="Total Enrollments" value={totalEnrolled} icon={UserGroupIcon} color="#8b5cf6" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={CheckmarkCircle01Icon} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        {(['modules', 'enrollments'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="pb-2 text-[13px] capitalize transition-colors"
            style={{
              borderBottom: activeTab === tab ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--theme-accent)' : 'var(--theme-muted)',
              fontWeight: activeTab === tab ? 600 : 400,
            }}>
            {tab === 'modules' ? 'Modules' : 'Enrollments'}
          </button>
        ))}
      </div>

      {activeTab === 'modules' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className="rounded-full border px-3 py-1 text-[12px] transition-all duration-150"
                style={{
                  background: categoryFilter === cat
                    ? 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))'
                    : 'var(--theme-hover)',
                  borderColor: categoryFilter === cat
                    ? 'color-mix(in srgb, var(--theme-accent) 40%, transparent)'
                    : 'transparent',
                  color: categoryFilter === cat ? 'var(--theme-accent)' : 'var(--theme-muted)',
                  fontWeight: categoryFilter === cat ? 600 : 400,
                }}>
                {cat}
              </button>
            ))}
          </div>

          {modulesQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl border"
                  style={{ borderColor: 'var(--theme-border)', background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }} />
              ))}
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-2xl border py-16 text-center"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))', color: 'var(--theme-accent)' }}>
                <HugeiconsIcon icon={SchoolIcon} size={26} />
              </div>
              <p className="text-[14px] font-semibold text-[var(--theme-text)]">No training modules yet</p>
              <p className="mt-1 text-[12px] text-[var(--theme-muted)]">Create your first module to start educating your community.</p>
              <button onClick={() => setEditingModule(null)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
                <HugeiconsIcon icon={Add01Icon} size={13} />
                New Module
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(module => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  brand={brand.id}
                  onEdit={() => setEditingModule(module)}
                  onLessons={() => setLessonsModule(module)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'enrollments' && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--theme-border)' }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
                {['Contact', 'Module', 'Progress', 'Started', 'Last Active', 'Completed'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-[var(--theme-muted)]">No enrollments yet</td></tr>
              ) : enrollments.map(e => {
                const mod = modules.find(m => m.id === e.module_id)
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-[var(--theme-hover)]"
                    style={{ borderColor: 'var(--theme-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--theme-text)]">{e.contact_name}</div>
                      {e.contact_email && <div className="text-[11px] text-[var(--theme-muted)]">{e.contact_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text)]">{mod?.title ?? e.module_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${e.progress}%`, background: 'linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))' }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">{e.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--theme-muted)]">{new Date(e.started_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--theme-muted)]">{new Date(e.last_accessed_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {e.completed_at ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-600">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />
                          {new Date(e.completed_at).toLocaleDateString()}
                        </span>
                      ) : <span className="text-[11px] text-[var(--theme-muted)]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingModule !== undefined && (
        <ModuleModal
          initial={editingModule}
          brand={brand.id}
          onSave={handleSaveModule}
          onClose={() => setEditingModule(undefined)}
        />
      )}

      {lessonsModule && (
        <LessonsPanel
          module={lessonsModule}
          brand={brand.id}
          onClose={() => setLessonsModule(null)}
        />
      )}
    </ScreenShell>
  )
}
