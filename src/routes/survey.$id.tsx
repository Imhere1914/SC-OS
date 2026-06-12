/**
 * Public survey response page — /survey/:id
 * No auth required. Renders the survey and accepts responses.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

export const Route = createFileRoute('/survey/$id')({ component: SurveyPage })

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

interface PublicSurvey {
  id: string
  brand: string
  title: string
  description?: string
  questions: SurveyQuestion[]
  status: 'draft' | 'active' | 'closed'
}

// ── Question renderers ────────────────────────────────────────────────────────

function NpsQuestion({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: number | undefined
  onChange: (v: number) => void
}) {
  const scores = Array.from({ length: 11 }, (_, i) => i)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {scores.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={[
              'w-10 h-10 rounded-lg text-sm font-semibold border transition-all',
              value === n
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 px-1">
        <span className="text-xs text-gray-400">{question.min_label ?? 'Not at all likely'}</span>
        <span className="text-xs text-gray-400">{question.max_label ?? 'Extremely likely'}</span>
      </div>
    </div>
  )
}

function RatingQuestion({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: number | undefined
  onChange: (v: number) => void
}) {
  const scale = question.scale ?? 5
  const scores = Array.from({ length: scale }, (_, i) => i + 1)
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center">
        {scores.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={[
              'w-10 h-10 rounded-lg text-sm font-semibold border transition-all',
              value === n
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>
      {(question.min_label || question.max_label) && (
        <div className="flex justify-between mt-2 px-1">
          <span className="text-xs text-gray-400">{question.min_label ?? ''}</span>
          <span className="text-xs text-gray-400">{question.max_label ?? ''}</span>
        </div>
      )}
    </div>
  )
}

function TextQuestion({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={4}
      placeholder="Your answer…"
      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    />
  )
}

function SingleChoiceQuestion({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {(question.options ?? []).map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
          <div
            className={[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
              value === opt ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400',
            ].join(' ')}
            onClick={() => onChange(opt)}
          >
            {value === opt && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function MultipleChoiceQuestion({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }
  return (
    <div className="space-y-2">
      {(question.options ?? []).map(opt => {
        const checked = value.includes(opt)
        return (
          <label key={opt} className="flex items-center gap-3 cursor-pointer group">
            <div
              className={[
                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400',
              ].join(' ')}
              onClick={() => toggle(opt)}
            >
              {checked && (
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SurveyPage() {
  const { id } = Route.useParams()
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: survey, isLoading, isError, error } = useQuery<PublicSurvey>({
    queryKey: ['survey-public', id],
    queryFn: async () => {
      const res = await fetch(`/api/surveys/${id}/public`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      return res.json() as Promise<PublicSurvey>
    },
    retry: false,
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/surveys/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => setSubmitted(true),
  })

  const setAnswer = (qId: string, val: string | number | string[]) => {
    setAnswers(prev => ({ ...prev, [qId]: val }))
    if (errors[qId]) setErrors(prev => { const n = { ...prev }; delete n[qId]; return n })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey) return
    const newErrors: Record<string, string> = {}
    for (const q of survey.questions) {
      if (!q.required) continue
      const val = answers[q.id]
      if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
        newErrors[q.id] = 'This question is required'
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    submit.mutate()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isError || !survey) {
    const msg = (error as Error)?.message ?? 'Survey not found'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-gray-400">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Survey Not Available</h2>
          <p className="text-sm text-gray-500">{msg}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-green-600">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 text-sm">Your response has been recorded. We appreciate your feedback.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
          {survey.description && (
            <p className="text-gray-500 text-sm leading-relaxed">{survey.description}</p>
          )}
        </div>

        {/* Questions */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {survey.questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-6"
            >
              <p className="text-sm font-semibold text-gray-800 mb-4">
                <span className="text-gray-400 mr-2">{idx + 1}.</span>
                {q.text}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </p>

              {q.type === 'nps' && (
                <NpsQuestion
                  question={q}
                  value={answers[q.id] as number | undefined}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}
              {q.type === 'rating' && (
                <RatingQuestion
                  question={q}
                  value={answers[q.id] as number | undefined}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}
              {q.type === 'text' && (
                <TextQuestion
                  value={(answers[q.id] as string) ?? ''}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}
              {q.type === 'single_choice' && (
                <SingleChoiceQuestion
                  question={q}
                  value={(answers[q.id] as string) ?? ''}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}
              {q.type === 'multiple_choice' && (
                <MultipleChoiceQuestion
                  question={q}
                  value={(answers[q.id] as string[]) ?? []}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}

              {errors[q.id] && (
                <p className="mt-2 text-xs text-red-500">{errors[q.id]}</p>
              )}
            </div>
          ))}

          {submit.isError && (
            <p className="text-sm text-red-500 text-center">
              {(submit.error as Error)?.message ?? 'Failed to submit. Please try again.'}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.isPending}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {submit.isPending ? 'Submitting…' : 'Submit Response'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by AI OS
        </p>
      </div>
    </div>
  )
}
