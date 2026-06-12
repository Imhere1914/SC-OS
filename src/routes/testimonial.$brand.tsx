import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/testimonial/$brand')({ component: TestimonialFormPage })

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="text-2xl transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <span style={{ color: star <= (hover || value) ? '#f59e0b' : '#d1d5db' }}>★</span>
        </button>
      ))}
    </div>
  )
}

function TestimonialFormPage() {
  const { brand } = Route.useParams()
  const brandName = brand.toUpperCase()

  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorTitle, setAuthorTitle] = useState('')
  const [authorCompany, setAuthorCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || !authorName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          author_name: authorName.trim(),
          author_title: authorTitle.trim() || undefined,
          author_company: authorCompany.trim() || undefined,
          body: body.trim(),
          rating: rating || undefined,
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-16">
          <div className="mb-6 flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thank you!</h1>
          <p className="text-gray-500 text-base">
            Your testimonial has been submitted and is pending review. We appreciate you taking the time to share your experience.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5 text-white font-bold text-lg shadow-md"
            style={{ background: 'linear-gradient(135deg, #4f7ef8, #000)' }}
          >
            {brandName.slice(0, 2)}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Share your experience with {brandName}
          </h1>
          <p className="text-gray-500 text-sm">
            Your feedback helps us improve and inspires others.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall rating
              </label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            {/* Testimonial body */}
            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1.5">
                Your testimonial <span className="text-red-500">*</span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                required
                placeholder="Share what you loved about working with us…"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                required
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Job title & company — two columns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Job title
                </label>
                <input
                  id="title"
                  type="text"
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                  placeholder="CEO"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company
                </label>
                <input
                  id="company"
                  type="text"
                  value={authorCompany}
                  onChange={(e) => setAuthorCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !body.trim() || !authorName.trim()}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4f7ef8, #000)' }}
            >
              {submitting ? 'Submitting…' : 'Submit testimonial'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Your submission will be reviewed before it appears publicly.
        </p>
      </div>
    </div>
  )
}
