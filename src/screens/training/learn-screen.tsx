import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookOpen01Icon,
  CheckmarkCircle01Icon,
  CheckmarkSquare02Icon,
  Clock01Icon,
  File01Icon,
  FileAudioIcon,
  LockIcon,
  Mic01Icon,
  PauseIcon,
  PlayIcon,
  Quiz03Icon,
  SchoolIcon,
  UserGroupIcon,
  VideoIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Loading03Icon,
  HonourStarIcon,
} from '@hugeicons/core-free-icons'

// ── Types ─────────────────────────────────────────────────────────────────────

type LessonType = 'text' | 'video' | 'audio' | 'pdf' | 'quiz'

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
  image_urls?: string[]
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
  status: string
  is_free: boolean
  price_cents?: number
  lessons: Lesson[]
  tags: string[]
  total_duration_minutes: number
  enrolled_count: number
}

interface Enrollment {
  id: string
  module_id: string
  contact_name: string
  contact_email?: string
  progress: number
  completed_lessons: string[]
  started_at: string
  completed_at?: string
  last_accessed_at: string
}

interface ContentSection {
  index: number
  level: 2 | 3
  title: string
  html: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSON_ICONS: Record<LessonType, typeof BookOpen01Icon> = {
  text: BookOpen01Icon,
  video: VideoIcon,
  audio: FileAudioIcon,
  pdf: File01Icon,
  quiz: Quiz03Icon,
}

const ENROLLMENT_KEY = (id: string) => `hfm_enrollment_${id}`

// Category → Unsplash photo IDs (stable CDN links)
const CATEGORY_HERO: Record<string, string> = {
  'Holistic Foundations':    'photo-1506905925346-21bda4d32df4',
  'Mind-Body Connection':    'photo-1544367567-0f2fcb009e0b',
  'Energy Medicine':         'photo-1518531933037-91b2f5f229cc',
  'Functional Nutrition':    'photo-1490645935967-10de6ba17061',
  'Metaphysical Wellness':   'photo-1574169208507-84376144848b',
}

const SECTION_ACCENT = ['#c4a04e', '#7ab5a0', '#a07ab5', '#b57a7a', '#7a9ab5']

function unsplashUrl(id: string, w = 1200) {
  return `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`
}

function getHeroId(category: string, _slug: string): string {
  return CATEGORY_HERO[category] ?? CATEGORY_HERO['Holistic Foundations'] ?? 'photo-1571019613454-1cb2f99b2d8b'
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── HTML Section Parser ────────────────────────────────────────────────────────

function parseSections(html: string): ContentSection[] {
  const headingRe = /<h([23])(?:[^>]*)>([\s\S]*?)<\/h[23]>/gi
  const headings: { start: number; end: number; level: 2 | 3; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(html)) !== null) {
    headings.push({
      start: m.index,
      end: m.index + m[0].length,
      level: parseInt(m[1]) as 2 | 3,
      title: m[2].replace(/<[^>]+>/g, '').trim(),
    })
  }

  if (headings.length === 0) return [{ index: 0, level: 2, title: '', html }]

  const sections: ContentSection[] = []
  let idx = 0

  // Pre-heading content
  if (headings[0].start > 0) {
    const pre = html.slice(0, headings[0].start).trim()
    if (pre) sections.push({ index: idx++, level: 2, title: '', html: pre })
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const nextStart = i < headings.length - 1 ? headings[i + 1].start : html.length
    const body = html.slice(h.end, nextStart).trim()
    if (body) sections.push({ index: idx++, level: h.level, title: h.title, html: body })
  }

  return sections
}

// ── Voice Narrator ─────────────────────────────────────────────────────────────

function VoiceNarrator({ lesson }: { lesson: Lesson }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const handleToggle = useCallback(async () => {
    if (state === 'loading') return

    if (state === 'playing') {
      audioRef.current?.pause()
      setState('paused')
      return
    }
    if (state === 'paused' && audioRef.current) {
      audioRef.current.play()
      setState('playing')
      return
    }

    // Fresh start
    setState('loading')
    try {
      const text = stripHtml(lesson.content_html ?? lesson.title).slice(0, 4000)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) { setState('idle'); return }
      const blob = await res.blob()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setState('idle')
      audio.onerror = () => setState('idle')
      audio.play()
      setState('playing')
    } catch {
      setState('idle')
    }
  }, [state, lesson])

  // Reset on lesson change
  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setState('idle')
  }, [lesson.id])

  const icon = state === 'loading' ? Loading03Icon : state === 'playing' ? PauseIcon : PlayIcon
  const label = state === 'loading' ? 'Preparing…' : state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Narrate'

  return (
    <button
      onClick={() => void handleToggle()}
      disabled={state === 'loading'}
      className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all"
      style={{
        background: state === 'playing' ? 'rgba(196,160,78,0.18)' : 'rgba(196,160,78,0.1)',
        color: '#c4a04e',
        border: '1px solid rgba(196,160,78,0.3)',
      }}
    >
      <HugeiconsIcon
        icon={icon}
        size={14}
        className={state === 'loading' ? 'animate-spin' : ''}
      />
      <HugeiconsIcon icon={Mic01Icon} size={12} />
      {label}
    </button>
  )
}

// ── Quiz Component ─────────────────────────────────────────────────────────────

function AnimatedQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  const handleSubmit = () => {
    let correct = 0
    questions.forEach(q => {
      if (q.correct_answer && answers[q.id]?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()) correct++
    })
    setScore(correct)
    setSubmitted(true)
  }

  const pct = submitted ? Math.round((score / questions.length) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, qi) => (
        <div
          key={q.id}
          className="rounded-2xl border p-5"
          style={{
            borderColor: 'rgba(196,160,78,0.2)',
            background: 'rgba(20,16,11,0.7)',
            animationDelay: `${qi * 0.08}s`,
          }}
        >
          <div className="mb-4 flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(196,160,78,0.2)', color: '#c4a04e' }}
            >
              {qi + 1}
            </span>
            <p className="text-[14px] font-medium leading-relaxed" style={{ color: '#ede5d8' }}>{q.question}</p>
          </div>

          {q.type === 'multiple_choice' && q.options && (
            <div className="flex flex-col gap-2 pl-10">
              {q.options.map((opt, oi) => {
                const sel = answers[q.id] === opt
                const correct = submitted && q.correct_answer === opt
                const wrong = submitted && sel && q.correct_answer !== opt
                return (
                  <label
                    key={oi}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-all"
                    style={{
                      borderColor: correct ? '#6db57a' : wrong ? '#b57a7a' : sel ? '#c4a04e' : 'rgba(196,160,78,0.15)',
                      background: correct ? 'rgba(109,181,122,0.12)' : wrong ? 'rgba(181,122,122,0.12)' : sel ? 'rgba(196,160,78,0.1)' : 'transparent',
                      cursor: submitted ? 'default' : 'pointer',
                    }}
                  >
                    <input
                      type="radio" name={q.id} value={opt} checked={sel}
                      onChange={() => !submitted && setAnswers(p => ({ ...p, [q.id]: opt }))}
                      disabled={submitted}
                      style={{ accentColor: '#c4a04e' }}
                    />
                    <span className="text-[13px]" style={{ color: correct ? '#6db57a' : wrong ? '#b57a7a' : '#ede5d8' }}>{opt}</span>
                    {correct && <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="ml-auto" style={{ color: '#6db57a' }} />}
                  </label>
                )
              })}
            </div>
          )}

          {q.type === 'true_false' && (
            <div className="flex gap-3 pl-10">
              {['True', 'False'].map(opt => {
                const sel = answers[q.id] === opt
                const correct = submitted && q.correct_answer?.toLowerCase() === opt.toLowerCase()
                const wrong = submitted && sel && q.correct_answer?.toLowerCase() !== opt.toLowerCase()
                return (
                  <button
                    key={opt}
                    onClick={() => !submitted && setAnswers(p => ({ ...p, [q.id]: opt }))}
                    disabled={submitted}
                    className="flex-1 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all"
                    style={{
                      borderColor: correct ? '#6db57a' : wrong ? '#b57a7a' : sel ? '#c4a04e' : 'rgba(196,160,78,0.2)',
                      background: correct ? 'rgba(109,181,122,0.12)' : wrong ? 'rgba(181,122,122,0.12)' : sel ? 'rgba(196,160,78,0.1)' : 'transparent',
                      color: correct ? '#6db57a' : wrong ? '#b57a7a' : sel ? '#c4a04e' : '#9a8870',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {q.type === 'short_answer' && (
            <input
              value={answers[q.id] ?? ''}
              onChange={e => !submitted && setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
              disabled={submitted}
              placeholder="Your answer…"
              className="ml-10 w-[calc(100%-2.5rem)] rounded-xl border px-4 py-2 text-[13px] outline-none"
              style={{
                borderColor: 'rgba(196,160,78,0.25)',
                background: 'rgba(196,160,78,0.05)',
                color: '#ede5d8',
              }}
            />
          )}

          {submitted && q.explanation && (
            <div
              className="mt-3 ml-10 rounded-xl px-4 py-2.5 text-[12px] leading-relaxed"
              style={{ background: 'rgba(122,160,181,0.1)', color: '#8bb5c8', borderLeft: '3px solid rgba(122,160,181,0.4)' }}
            >
              {q.explanation}
            </div>
          )}
        </div>
      ))}

      {!submitted ? (
        <button
          onClick={handleSubmit}
          className="w-full rounded-2xl py-3.5 text-[14px] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #a3843b, #c4a04e)', boxShadow: '0 4px 20px rgba(196,160,78,0.25)' }}
        >
          Submit Quiz
        </button>
      ) : (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: 'rgba(196,160,78,0.08)', border: '1px solid rgba(196,160,78,0.2)' }}
        >
          <div className="mb-2 flex items-center justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <HugeiconsIcon
                key={i} icon={HonourStarIcon} size={20}
                style={{ color: i < Math.ceil(pct / 20) ? '#c4a04e' : 'rgba(196,160,78,0.2)' }}
              />
            ))}
          </div>
          <p className="text-[28px] font-bold" style={{ color: '#c4a04e' }}>{score}/{questions.length}</p>
          <p className="mt-1 text-[14px]" style={{ color: '#9a8870' }}>
            {pct === 100 ? 'Perfect score! Outstanding.' : pct >= 70 ? 'Great work — keep it up.' : 'Good effort — review and try again.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Enrollment Form ────────────────────────────────────────────────────────────

function EnrollmentForm({ onEnroll }: { onEnroll: (name: string, email: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      await onEnroll(name.trim(), email.trim())
    } catch {
      setError('Enrollment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full rounded-xl border px-4 py-3 text-[14px] outline-none transition-all"
  const inputStyle = {
    borderColor: 'rgba(196,160,78,0.25)',
    background: 'rgba(196,160,78,0.05)',
    color: '#ede5d8',
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(196,160,78,0.06)', border: '1px solid rgba(196,160,78,0.2)' }}>
      <h3 className="mb-1 text-[16px] font-bold" style={{ color: '#ede5d8' }}>Enroll to access all lessons</h3>
      <p className="mb-5 text-[13px]" style={{ color: '#9a8870' }}>Free enrollment — begin your journey today.</p>
      {error && (
        <p className="mb-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: 'rgba(181,122,122,0.12)', color: '#c87a7a' }}>{error}</p>
      )}
      <form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-3">
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className={inputCls} style={inputStyle}
        />
        <input
          value={email} onChange={e => setEmail(e.target.value)}
          type="email" placeholder="Email (optional)"
          className={inputCls} style={inputStyle}
        />
        <button
          type="submit" disabled={loading}
          className="rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #a3843b, #c4a04e)', boxShadow: '0 4px 20px rgba(196,160,78,0.25)' }}
        >
          {loading ? 'Enrolling…' : 'Enroll Free'}
        </button>
      </form>
    </div>
  )
}

// ── Section Reveal ─────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  delay,
  accentColor,
  imageUrl,
}: {
  section: ContentSection
  delay: number
  accentColor: string
  imageUrl?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      ref={ref}
      className="transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      {section.title && (
        <div className="mb-4 flex items-center gap-3">
          <div
            className="h-4 w-1 rounded-full"
            style={{ background: accentColor }}
          />
          <h2
            className="text-[18px] font-bold"
            style={{
              color: section.level === 2 ? '#ede5d8' : '#c4a04e',
              fontSize: section.level === 2 ? '18px' : '15px',
              letterSpacing: section.level === 3 ? '0.04em' : undefined,
              textTransform: section.level === 3 ? 'uppercase' : undefined,
            }}
          >
            {section.title}
          </h2>
        </div>
      )}

      {imageUrl && (
        <div
          className="mb-5 overflow-hidden rounded-2xl"
          style={{ height: '200px' }}
        >
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: 'brightness(0.85)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div
        className="learn-prose"
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </div>
  )
}

// ── Lesson Player ──────────────────────────────────────────────────────────────

function LessonPlayer({
  lesson,
  module,
  lessonIndex,
  totalLessons,
  isEnrolled,
  isCompleted,
  onComplete,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
}: {
  lesson: Lesson
  module: TrainingModule
  lessonIndex: number
  totalLessons: number
  isEnrolled: boolean
  isCompleted: boolean
  onComplete: () => void
  onNext: () => void
  onPrev: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const [sections, setSections] = useState<ContentSection[]>([])
  const [showCelebrate, setShowCelebrate] = useState(false)
  const heroId = getHeroId(module.category, module.slug)
  const accent = SECTION_ACCENT[lessonIndex % SECTION_ACCENT.length]

  useEffect(() => {
    if (lesson.type === 'text' && lesson.content_html) {
      setSections(parseSections(lesson.content_html))
    } else {
      setSections([])
    }
  }, [lesson.id, lesson.type, lesson.content_html])

  const handleComplete = () => {
    setShowCelebrate(true)
    setTimeout(() => setShowCelebrate(false), 3000)
    onComplete()
  }

  // Mid-content image: show after the 2nd section if we have sections
  const midImageIdx = Math.floor(sections.length / 2)

  return (
    <div className="flex flex-col">
      {/* Hero banner */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ minHeight: '220px' }}
      >
        <img
          src={unsplashUrl(heroId, 1200)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'brightness(0.35)' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(14,12,9,0.6) 0%, rgba(10,8,6,0.85) 100%)' }}
        />
        <div className="relative z-10 p-8">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(196,160,78,0.15)', color: '#c4a04e', border: '1px solid rgba(196,160,78,0.3)' }}
            >
              {module.category}
            </span>
            <span className="text-[11px]" style={{ color: 'rgba(237,229,216,0.5)' }}>
              Lesson {lessonIndex + 1} of {totalLessons}
            </span>
            {lesson.duration_minutes != null && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(237,229,216,0.5)' }}>
                <HugeiconsIcon icon={Clock01Icon} size={10} />
                {lesson.duration_minutes}m
              </span>
            )}
          </div>

          <h1 className="text-[26px] font-bold leading-tight" style={{ color: '#ede5d8' }}>
            {lesson.title}
          </h1>

          {/* Lesson type badge */}
          <div className="mt-3 flex items-center gap-2">
            <HugeiconsIcon
              icon={LESSON_ICONS[lesson.type]}
              size={14}
              style={{ color: accent }}
            />
            <span className="capitalize text-[12px] font-medium" style={{ color: accent }}>
              {lesson.type}
            </span>
          </div>
        </div>

        {/* Progress bar on hero */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: 'rgba(196,160,78,0.15)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((lessonIndex + (isCompleted ? 1 : 0)) / totalLessons) * 100}%`,
              background: 'linear-gradient(90deg, #a3843b, #c4a04e)',
            }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div
        className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(20,16,11,0.7)', border: '1px solid rgba(196,160,78,0.12)' }}
      >
        {lesson.type === 'text' && <VoiceNarrator lesson={lesson} />}

        <div className="ml-auto flex items-center gap-2">
          {hasPrev && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-all"
              style={{ color: '#9a8870', border: '1px solid rgba(196,160,78,0.15)' }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={12} />
              Prev
            </button>
          )}
          {isEnrolled && !isCompleted ? (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #a3843b, #c4a04e)', boxShadow: '0 3px 12px rgba(196,160,78,0.3)' }}
            >
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
              Mark Complete
            </button>
          ) : isCompleted ? (
            <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#6db57a' }}>
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
              Completed
            </span>
          ) : null}
          {hasNext && (
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-all"
              style={{
                color: '#c4a04e',
                border: '1px solid rgba(196,160,78,0.3)',
                background: 'rgba(196,160,78,0.06)',
              }}
            >
              Next
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Completion celebration */}
      {showCelebrate && (
        <div
          className="mt-4 rounded-2xl p-4 text-center text-[14px] font-semibold"
          style={{
            background: 'rgba(109,181,122,0.12)',
            border: '1px solid rgba(109,181,122,0.3)',
            color: '#6db57a',
          }}
        >
          ✨ Lesson complete — well done!
        </div>
      )}

      {/* Main content */}
      <div className="mt-6 flex flex-col gap-7">
        {lesson.type === 'text' && sections.map((sec, i) => (
          <div key={sec.index}>
            <SectionBlock
              section={sec}
              delay={i * 120}
              accentColor={SECTION_ACCENT[i % SECTION_ACCENT.length]}
              imageUrl={
                i === midImageIdx && i > 0
                  ? unsplashUrl(heroId, 800)
                  : lesson.image_urls?.[i - 1]
              }
            />
            {i < sections.length - 1 && (
              <div
                className="mt-7 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(196,160,78,0.15), transparent)' }}
              />
            )}
          </div>
        ))}

        {lesson.type === 'video' && (
          lesson.video_url ? (
            <div className="overflow-hidden rounded-2xl" style={{ paddingBottom: '56.25%', position: 'relative', height: 0 }}>
              <iframe
                src={lesson.video_url}
                title={lesson.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full rounded-2xl"
              />
            </div>
          ) : (
            <p className="text-center text-[14px]" style={{ color: '#9a8870' }}>No video URL provided.</p>
          )
        )}

        {lesson.type === 'audio' && (
          lesson.audio_url ? (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'rgba(196,160,78,0.06)', border: '1px solid rgba(196,160,78,0.15)' }}
            >
              <p className="mb-3 text-[12px] font-medium uppercase tracking-widest" style={{ color: '#c4a04e' }}>Audio Lesson</p>
              <audio controls className="w-full" src={lesson.audio_url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : (
            <p className="text-center text-[14px]" style={{ color: '#9a8870' }}>No audio URL provided.</p>
          )
        )}

        {lesson.type === 'pdf' && (
          lesson.pdf_url ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'rgba(196,160,78,0.06)', border: '1px solid rgba(196,160,78,0.15)' }}
            >
              <HugeiconsIcon icon={File01Icon} size={40} className="mx-auto mb-4" style={{ color: '#c4a04e' }} />
              <a
                href={lesson.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-[14px] font-medium underline"
                style={{ color: '#c4a04e' }}
              >
                Open PDF Document
              </a>
            </div>
          ) : (
            <p className="text-center text-[14px]" style={{ color: '#9a8870' }}>No PDF URL provided.</p>
          )
        )}

        {lesson.type === 'quiz' && (
          lesson.quiz_questions && lesson.quiz_questions.length > 0
            ? <AnimatedQuiz questions={lesson.quiz_questions} />
            : <p className="text-center text-[14px]" style={{ color: '#9a8870' }}>No quiz questions yet.</p>
        )}

        {/* Extra images if provided */}
        {lesson.image_urls && lesson.image_urls.length > 0 && lesson.type !== 'text' && (
          <div className="flex flex-col gap-4">
            {lesson.image_urls.map((url, i) => (
              <img
                key={i} src={url} alt=""
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: '320px' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Learn Screen ──────────────────────────────────────────────────────────

export function LearnScreen() {
  const params = useParams({ from: '/learn/$slug' })
  const slug = params.slug
  const brand = 'hfm'

  const [module, setModule] = useState<TrainingModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/training/public/${slug}?brand=${brand}`)
        if (!res.ok) { setNotFound(true); return }
        const data = await res.json() as { module?: TrainingModule }
        if (data.module) {
          setModule(data.module)
          const sorted = [...data.module.lessons].sort((a, b) => a.order - b.order)
          if (sorted.length > 0) setActiveLesson(sorted[0])
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  useEffect(() => {
    if (!module) return
    const stored = localStorage.getItem(ENROLLMENT_KEY(module.id))
    if (stored) {
      try {
        const e = JSON.parse(stored) as Enrollment
        setEnrollment(e)
        setCompletedIds(new Set(e.completed_lessons))
      } catch { /* ignore */ }
    }
  }, [module])

  const handleEnroll = async (name: string, email: string) => {
    if (!module) return
    const res = await fetch('/api/training/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_id: module.id, contact_name: name, contact_email: email, brand }),
    })
    if (!res.ok) throw new Error('Enrollment failed')
    const data = await res.json() as { enrollment?: Enrollment }
    if (data.enrollment) {
      setEnrollment(data.enrollment)
      localStorage.setItem(ENROLLMENT_KEY(module.id), JSON.stringify(data.enrollment))
    }
  }

  const markComplete = async (lessonId: string) => {
    if (!enrollment || !module) return
    const newIds = new Set(completedIds)
    newIds.add(lessonId)
    setCompletedIds(newIds)

    const sorted = [...module.lessons].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(l => l.id === lessonId)
    if (idx < sorted.length - 1) setActiveLesson(sorted[idx + 1])

    try {
      const res = await fetch('/api/training/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollment.id, completed_lesson_id: lessonId, brand }),
      })
      if (res.ok) {
        const data = await res.json() as { enrollment?: Enrollment }
        if (data.enrollment) {
          setEnrollment(data.enrollment)
          localStorage.setItem(ENROLLMENT_KEY(module.id), JSON.stringify(data.enrollment))
        }
      }
    } catch { /* non-critical */ }
  }

  // Loading state
  if (loading) {
    return (
      <div className="learn-root flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px]"
            style={{ borderColor: 'rgba(196,160,78,0.2)', borderTopColor: '#c4a04e' }}
          />
          <p className="text-[14px]" style={{ color: '#9a8870' }}>Loading course…</p>
        </div>
        <LearnStyles />
      </div>
    )
  }

  if (notFound || !module) {
    return (
      <div className="learn-root flex min-h-screen items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon icon={SchoolIcon} size={52} className="mx-auto mb-5" style={{ color: 'rgba(196,160,78,0.3)' }} />
          <h1 className="text-[22px] font-bold" style={{ color: '#ede5d8' }}>Course Not Found</h1>
          <p className="mt-2 text-[14px]" style={{ color: '#9a8870' }}>This course may have been removed or is not yet published.</p>
        </div>
        <LearnStyles />
      </div>
    )
  }

  const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order)
  const isEnrolled = !!enrollment
  const progress = enrollment?.progress ?? 0
  const canAccess = (l: Lesson) => l.is_preview || isEnrolled
  const activeLessonIdx = activeLesson ? sortedLessons.findIndex(l => l.id === activeLesson.id) : 0

  return (
    <div className="learn-root min-h-screen">
      <LearnStyles />

      {/* Top navigation bar */}
      <header
        className="sticky top-0 z-30 border-b px-6 py-3"
        style={{
          background: 'rgba(10,8,6,0.97)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(196,160,78,0.12)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
            style={{ background: 'rgba(196,160,78,0.1)', color: '#c4a04e' }}
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={16} />
          </button>

          {/* Module icon + title */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #a3843b, #c4a04e)' }}
          >
            <HugeiconsIcon icon={SchoolIcon} size={16} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-bold" style={{ color: '#ede5d8' }}>{module.title}</h1>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: '#9a8870' }}>
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={BookOpen01Icon} size={10} />
                {sortedLessons.length} lessons
              </span>
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Clock01Icon} size={10} />
                {formatDuration(module.total_duration_minutes)}
              </span>
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={UserGroupIcon} size={10} />
                {module.enrolled_count} enrolled
              </span>
              {module.is_free && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(109,181,122,0.15)', color: '#6db57a' }}
                >
                  Free
                </span>
              )}
            </div>
          </div>

          {/* Progress */}
          {isEnrolled && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-1.5 w-28 overflow-hidden rounded-full" style={{ background: 'rgba(196,160,78,0.15)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #a3843b, #c4a04e)' }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#c4a04e' }}>{progress}%</span>
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="mx-auto flex max-w-7xl gap-0 lg:gap-6 px-0 lg:px-6 py-0 lg:py-6">
        {/* Sidebar */}
        <aside
          className={`
            fixed top-0 left-0 z-40 h-full w-[280px] overflow-y-auto border-r pt-16 transition-transform lg:relative lg:top-auto lg:z-auto lg:h-auto lg:w-[260px] lg:shrink-0 lg:translate-x-0 lg:pt-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{
            background: 'rgba(8,6,4,0.99)',
            borderColor: 'rgba(196,160,78,0.12)',
          }}
        >
          {/* Module overview card */}
          {module.instructor_name && (
            <div
              className="m-4 rounded-2xl p-4"
              style={{ background: 'rgba(196,160,78,0.06)', border: '1px solid rgba(196,160,78,0.12)' }}
            >
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(196,160,78,0.6)' }}>Instructor</p>
              <p className="text-[13px] font-semibold" style={{ color: '#ede5d8' }}>{module.instructor_name}</p>
              {module.instructor_bio && (
                <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: '#9a8870' }}>{module.instructor_bio}</p>
              )}
            </div>
          )}

          {/* Tags */}
          {module.tags.length > 0 && (
            <div className="mx-4 mb-4 flex flex-wrap gap-1.5">
              {module.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'rgba(196,160,78,0.08)', color: '#9a8870', border: '1px solid rgba(196,160,78,0.12)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Lesson list */}
          <div className="border-t mx-4 pt-4" style={{ borderColor: 'rgba(196,160,78,0.1)' }}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(196,160,78,0.6)' }}>
              Course Content
            </p>
            <div className="flex flex-col gap-1">
              {sortedLessons.map((lesson, idx) => {
                const accessible = canAccess(lesson)
                const completed = completedIds.has(lesson.id)
                const active = activeLesson?.id === lesson.id
                return (
                  <button
                    key={lesson.id}
                    onClick={() => {
                      if (accessible) {
                        setActiveLesson(lesson)
                        setSidebarOpen(false)
                      }
                    }}
                    disabled={!accessible}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
                    style={{
                      background: active ? 'rgba(196,160,78,0.1)' : 'transparent',
                      border: active ? '1px solid rgba(196,160,78,0.2)' : '1px solid transparent',
                      opacity: accessible ? 1 : 0.45,
                      cursor: accessible ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: completed ? 'rgba(109,181,122,0.15)' : active ? 'rgba(196,160,78,0.15)' : 'rgba(196,160,78,0.06)',
                        color: completed ? '#6db57a' : active ? '#c4a04e' : '#9a8870',
                      }}
                    >
                      {completed ? (
                        <HugeiconsIcon icon={CheckmarkSquare02Icon} size={12} />
                      ) : !accessible ? (
                        <HugeiconsIcon icon={LockIcon} size={11} />
                      ) : (
                        <HugeiconsIcon icon={LESSON_ICONS[lesson.type]} size={11} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[12px] font-medium leading-snug"
                        style={{ color: active ? '#c4a04e' : completed ? '#6db57a' : '#ede5d8' }}
                      >
                        {idx + 1}. {lesson.title}
                      </p>
                      <p className="mt-0.5 text-[10px]" style={{ color: '#9a8870' }}>
                        <span className="capitalize">{lesson.type}</span>
                        {lesson.duration_minutes != null && ` · ${lesson.duration_minutes}m`}
                        {lesson.is_preview && <span style={{ color: '#c4a04e' }}> · Preview</span>}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-6" />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content area */}
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-0 lg:py-0">
          {activeLesson ? (
            canAccess(activeLesson) ? (
              <LessonPlayer
                lesson={activeLesson}
                module={module}
                lessonIndex={activeLessonIdx}
                totalLessons={sortedLessons.length}
                isEnrolled={isEnrolled}
                isCompleted={completedIds.has(activeLesson.id)}
                onComplete={() => void markComplete(activeLesson.id)}
                onNext={() => {
                  const next = sortedLessons[activeLessonIdx + 1]
                  if (next) setActiveLesson(next)
                }}
                onPrev={() => {
                  const prev = sortedLessons[activeLessonIdx - 1]
                  if (prev) setActiveLesson(prev)
                }}
                hasPrev={activeLessonIdx > 0}
                hasNext={activeLessonIdx < sortedLessons.length - 1}
              />
            ) : (
              <div className="rounded-2xl p-8" style={{ background: 'rgba(20,16,11,0.7)', border: '1px solid rgba(196,160,78,0.15)' }}>
                <h2 className="mb-2 text-[22px] font-bold" style={{ color: '#ede5d8' }}>{activeLesson.title}</h2>
                <p className="mb-6 text-[14px]" style={{ color: '#9a8870' }}>Enroll to access this lesson.</p>
                <EnrollmentForm onEnroll={handleEnroll} />
              </div>
            )
          ) : (
            <div className="rounded-2xl p-8" style={{ background: 'rgba(20,16,11,0.7)', border: '1px solid rgba(196,160,78,0.15)' }}>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ background: 'rgba(196,160,78,0.1)', color: '#c4a04e', border: '1px solid rgba(196,160,78,0.2)' }}
              >
                {module.category}
              </span>
              <h2 className="mt-4 mb-3 text-[26px] font-bold" style={{ color: '#ede5d8' }}>{module.title}</h2>
              <p className="mb-6 text-[15px] leading-relaxed" style={{ color: '#9a8870' }}>{module.description}</p>
              {!isEnrolled && <EnrollmentForm onEnroll={handleEnroll} />}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="mt-12 border-t py-6 px-6 text-center text-[12px]"
        style={{ borderColor: 'rgba(196,160,78,0.1)', color: 'rgba(154,136,112,0.5)' }}
      >
        © {new Date().getFullYear()} HFM Intelligence · All rights reserved
      </footer>
    </div>
  )
}

// ── Injected Styles ────────────────────────────────────────────────────────────

function LearnStyles() {
  return (
    <style>{`
      html, body { background-color: #0e0c09 !important; }
      .learn-root {
        background-color: #0e0c09;
        color: #ede5d8;
        font-family: inherit;
        min-height: 100vh;
      }
      .learn-root * {
        box-sizing: border-box;
      }
      .learn-prose p {
        color: #c8baa8;
        line-height: 1.75;
        margin-bottom: 1rem;
        font-size: 15px;
      }
      .learn-prose ul, .learn-prose ol {
        margin: 1rem 0;
        padding-left: 1.5rem;
        color: #c8baa8;
      }
      .learn-prose li {
        margin-bottom: 0.5rem;
        line-height: 1.7;
        font-size: 15px;
      }
      .learn-prose li::marker {
        color: #c4a04e;
      }
      .learn-prose strong {
        font-weight: 600;
        color: #e8d9c0;
      }
      .learn-prose em {
        color: #b8aa90;
        font-style: italic;
      }
      .learn-prose blockquote {
        border-left: 3px solid rgba(196,160,78,0.5);
        margin: 1.5rem 0;
        padding: 1rem 1.25rem;
        border-radius: 0 12px 12px 0;
        background: rgba(196,160,78,0.06);
        color: #b8aa90;
        font-style: italic;
        font-size: 15px;
        line-height: 1.7;
      }
      .learn-prose a {
        color: #c4a04e;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .learn-prose hr {
        border: none;
        border-top: 1px solid rgba(196,160,78,0.12);
        margin: 2rem 0;
      }
      .learn-prose code {
        background: rgba(196,160,78,0.1);
        color: #c4a04e;
        padding: 0.15em 0.4em;
        border-radius: 4px;
        font-size: 13px;
      }
      @keyframes learnFadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .learn-section-animate {
        animation: learnFadeUp 0.55s ease both;
      }
    `}</style>
  )
}
