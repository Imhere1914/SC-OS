/**
 * Public proposal view — /proposal/:id
 * No auth required. Renders the proposal cleanly with Accept / Decline buttons.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { ProposalSection, PricingContent } from '@/lib/proposals-api'

export const Route = createFileRoute('/proposal/$id')({ component: PublicProposalPage })

type PublicProposal = {
  id: string
  title: string
  brand?: string
  contact_name?: string
  contact_email?: string
  status: string
  sections: ProposalSection[]
  valid_until?: string
  notes?: string
  created_at: string
  signing_required?: boolean
  signed_at?: string
  signature_name?: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function RenderSection({ section }: { section: ProposalSection }) {
  if (section.type === 'heading') {
    return <h2 className="text-2xl font-bold text-gray-800 mt-10 mb-3">{section.content}</h2>
  }
  if (section.type === 'text') {
    return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{section.content}</p>
  }
  if (section.type === 'pricing') {
    try {
      const data = JSON.parse(section.content) as PricingContent
      const total = data.items.reduce((s, item) => s + item.qty * item.unit_price, 0)
      return (
        <div className="my-6 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 pl-4 text-left text-xs font-semibold text-gray-500">Description</th>
                <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 w-16">Qty</th>
                <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 w-28">Unit Price</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold text-gray-500 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 pl-4 text-gray-700">{item.description}</td>
                  <td className="py-3 px-3 text-center text-gray-600">{item.qty}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{fmt(item.unit_price)}</td>
                  <td className="py-3 pr-4 text-right font-medium text-gray-800">{fmt(item.qty * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
            {data.show_total && (
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="py-3 pr-3 text-right font-bold text-gray-700">Total</td>
                  <td className="py-3 pr-4 text-right text-lg font-bold text-gray-900">{fmt(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )
    } catch { return null }
  }
  if (section.type === 'signature') {
    return (
      <div className="mt-12 border-t border-gray-200 pt-8">
        <p className="text-sm text-gray-600">{section.content}</p>
      </div>
    )
  }
  return null
}

// ── Signature canvas panel ─────────────────────────────────────────────────────

function SignaturePanel({
  proposalId,
  onSigned,
}: {
  proposalId: string
  onSigned: (signedProposal: { signature_name: string; signed_at: string }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1e293b'
    ctx.lineCap = 'round'
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawing(true)
  }, [isDrawing])

  const stopDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(false)
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  const signMut = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('No canvas')
      const signatureData = canvas.toDataURL('image/png')
      const res = await fetch(`/api/proposals/${proposalId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: signatureData,
          signature_name: name.trim(),
          signature_email: email.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to sign proposal')
      }
      return res.json() as Promise<{ signature_name: string; signed_at: string }>
    },
    onSuccess: (data) => onSigned(data),
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('Please enter your full name.'); return }
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!hasDrawing) { setError('Please draw your signature above.'); return }
    signMut.mutate()
  }

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden no-print">
      <div className="border-b border-gray-100 px-8 py-5">
        <h2 className="text-lg font-bold text-gray-900">Ready to accept this proposal?</h2>
        <p className="mt-0.5 text-sm text-gray-500">Please fill in your details and draw your signature below.</p>
      </div>
      <div className="px-8 py-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Your email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-gray-600">Draw your signature</label>
          <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={160}
              className="w-full cursor-crosshair"
              style={{ height: '120px', display: 'block', background: '#fff' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          {!hasDrawing && (
            <p className="mt-1.5 text-xs text-gray-400">Draw your signature in the box above</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={clearCanvas}
            disabled={!hasDrawing || signMut.isPending}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={signMut.isPending}
            className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {signMut.isPending ? 'Signing…' : 'Sign & Accept →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PublicProposalPage() {
  const { id } = Route.useParams()
  const [actioned, setActioned] = useState<'accepted' | 'declined' | null>(null)
  const [signedData, setSignedData] = useState<{ signature_name: string; signed_at: string } | null>(null)

  const { data: proposal, isLoading, isError } = useQuery<PublicProposal>({
    queryKey: ['proposal-public', id],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/${id}/public`)
      if (!res.ok) throw new Error('Proposal not found')
      return res.json()
    },
  })

  const actionMut = useMutation({
    mutationFn: async (status: 'accepted' | 'declined') => {
      const res = await fetch(`/api/proposals/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: status === 'accepted' ? 'accept' : 'decline' }),
      })
      if (!res.ok) throw new Error('Failed to update proposal')
      return res.json()
    },
    onSuccess: (_data, status) => setActioned(status),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading proposal…</p>
      </div>
    )
  }

  if (isError || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm max-w-sm">
          <p className="text-lg font-semibold text-gray-800">Proposal not found</p>
          <p className="mt-1 text-sm text-gray-400">This proposal link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  const finalStatus = actioned ?? proposal.status
  const isResolved = finalStatus === 'accepted' || finalStatus === 'declined'

  // Signature panel visibility
  const showSignPanel =
    proposal.signing_required &&
    (proposal.status === 'sent' || proposal.status === 'viewed') &&
    !signedData &&
    actioned !== 'accepted'

  // Read-only signed state: already signed before this page load
  const alreadySigned =
    proposal.status === 'accepted' &&
    (proposal.signed_at || signedData)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="mx-auto max-w-[720px]">
        {/* Header */}
        <div className="mb-8">
          {proposal.brand && (
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4 text-center">{proposal.brand.toUpperCase()}</p>
          )}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Title band */}
            <div className="border-b border-gray-100 px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
                  {proposal.contact_name && (
                    <p className="mt-1 text-sm text-gray-500">
                      Prepared for: <span className="font-medium text-gray-700">{proposal.contact_name}</span>
                    </p>
                  )}
                  {proposal.valid_until && (
                    <p className="mt-1 text-xs text-gray-400">Valid until {fmtDate(proposal.valid_until)}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    (finalStatus === 'accepted' || signedData) ? 'bg-green-100 text-green-700'
                    : finalStatus === 'declined' ? 'bg-red-50 text-red-600'
                    : finalStatus === 'viewed' ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {signedData ? 'Accepted' : finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1)}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6">
              {proposal.sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map(section => (
                  <RenderSection key={section.id} section={section} />
                ))}
              {proposal.notes && (
                <div className="mt-8 rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.notes}</p>
                </div>
              )}
            </div>

            {/* CTA — only shown when signing is NOT required */}
            {!proposal.signing_required && (
              <div className="no-print border-t border-gray-100 px-8 py-6">
                {actioned === 'accepted' ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <span className="text-3xl">✅</span>
                    <p className="font-semibold text-gray-800">You've accepted this proposal — thank you!</p>
                    <p className="text-xs text-gray-400">We'll be in touch shortly to get started.</p>
                  </div>
                ) : actioned === 'declined' ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <span className="text-3xl">👋</span>
                    <p className="font-semibold text-gray-800">You've declined this proposal.</p>
                    <p className="text-xs text-gray-400">Thank you for your time. Feel free to reach out with any questions.</p>
                  </div>
                ) : isResolved ? (
                  <p className="text-center text-sm text-gray-400">
                    This proposal has been {finalStatus}.
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-gray-500">Ready to move forward?</p>
                    {actionMut.isError && (
                      <p className="text-xs text-red-500">Something went wrong — please try again.</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => actionMut.mutate('accepted')}
                        disabled={actionMut.isPending}
                        className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {actionMut.isPending ? 'Saving…' : 'Accept Proposal'}
                      </button>
                      <button
                        onClick={() => actionMut.mutate('declined')}
                        disabled={actionMut.isPending}
                        className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Signature panel — shown below main card when signing_required */}
          {signedData ? (
            // Just-signed success state
            <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 px-8 py-6 text-center no-print">
              <span className="text-3xl">✅</span>
              <p className="mt-2 font-semibold text-gray-800">
                Signed by {signedData.signature_name} on {fmtDate(signedData.signed_at)}
              </p>
              <p className="mt-1 text-xs text-gray-500">We'll be in touch shortly to get started.</p>
            </div>
          ) : alreadySigned ? (
            // Already-signed read-only confirmation
            <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 px-8 py-6 text-center no-print">
              <p className="font-semibold text-gray-800">
                ✅ Signed by {proposal.signature_name} on {fmtDate(proposal.signed_at!)}
              </p>
            </div>
          ) : showSignPanel ? (
            <SignaturePanel
              proposalId={id}
              onSigned={(data) => setSignedData(data)}
            />
          ) : null}
        </div>

        {/* Print button */}
        <div className="no-print flex justify-center">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Print / Save as PDF
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] text-gray-300">
          Created {fmtDate(proposal.created_at)}
        </p>
      </div>
    </div>
  )
}
