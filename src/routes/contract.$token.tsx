/**
 * Public contract signing page — /contract/:token
 * No auth required. Light theme, white background.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

export const Route = createFileRoute('/contract/$token')({ component: PublicContractPage })

type PublicContract = {
  id: string
  title: string
  contact_name?: string
  body_html: string
  status: string
  signed_at?: string
  signature_name?: string
  expires_at?: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Signature canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({
  token,
  onSigned,
}: {
  token: string
  onSigned: (name: string, signedAt: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

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
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e293b'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
      const res = await fetch(`/api/contracts/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: signatureData,
          signature_name: name.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to sign contract')
      }
      return res.json() as Promise<{ ok: boolean; signed_at: string }>
    },
    onSuccess: (data) => onSigned(name.trim(), data.signed_at),
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('Please enter your full name.'); return }
    if (!hasDrawing) { setError('Please draw your signature above.'); return }
    signMut.mutate()
  }

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-8 py-5">
        <h2 className="text-lg font-bold text-gray-900">Sign this contract</h2>
        <p className="mt-0.5 text-sm text-gray-500">Enter your name and draw your signature to sign.</p>
      </div>
      <div className="px-8 py-6 space-y-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Your full name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full legal name"
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-gray-600">Draw your signature *</label>
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={clearCanvas}
            disabled={!hasDrawing || signMut.isPending}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Clear signature
          </button>
          <button
            onClick={handleSubmit}
            disabled={signMut.isPending}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: '#2563eb' }}
          >
            {signMut.isPending ? 'Signing…' : 'Sign contract →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main public page ──────────────────────────────────────────────────────────

function PublicContractPage() {
  const { token } = Route.useParams()
  const [signedState, setSignedState] = useState<{ name: string; signedAt: string } | null>(null)

  const { data: contract, isLoading, isError } = useQuery<PublicContract>({
    queryKey: ['contract-public', token],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/sign/${token}`)
      if (!res.ok) throw new Error('Contract not found')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading contract…</p>
      </div>
    )
  }

  if (isError || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm max-w-sm">
          <p className="text-lg font-semibold text-gray-800">Contract not found</p>
          <p className="mt-1 text-sm text-gray-400">This contract link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const alreadySigned = contract.status === 'signed' || contract.signed_at

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-[720px]">
        {/* Header card */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-8 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
                {contract.contact_name && (
                  <p className="mt-1 text-sm text-gray-500">
                    For: <span className="font-medium text-gray-700">{contract.contact_name}</span>
                  </p>
                )}
                {contract.expires_at && (
                  <p className="mt-1 text-xs text-gray-400">Expires: {fmtDate(contract.expires_at)}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  contract.status === 'signed' ? 'bg-green-100 text-green-700'
                  : contract.status === 'expired' ? 'bg-orange-50 text-orange-600'
                  : contract.status === 'cancelled' ? 'bg-red-50 text-red-600'
                  : 'bg-blue-50 text-blue-600'
                }`}
              >
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Contract body */}
          <div
            className="px-8 py-6 text-sm text-gray-900 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: contract.body_html }}
          />
        </div>

        {/* Signing section */}
        {signedState ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-8 py-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-800">
              Signed by {signedState.name} on {fmtDate(signedState.signedAt)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Thank you. A copy has been recorded.</p>
          </div>
        ) : alreadySigned ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-8 py-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-800">
              Signed{contract.signature_name ? ` by ${contract.signature_name}` : ''}{contract.signed_at ? ` on ${fmtDate(contract.signed_at)}` : ''}
            </p>
          </div>
        ) : contract.status === 'expired' ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-8 py-6 text-center">
            <p className="font-semibold text-orange-700">This contract has expired.</p>
          </div>
        ) : contract.status === 'cancelled' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-8 py-6 text-center">
            <p className="font-semibold text-red-700">This contract has been cancelled.</p>
          </div>
        ) : (
          <SignatureCanvas
            token={token}
            onSigned={(name, signedAt) => setSignedState({ name, signedAt })}
          />
        )}

        <p className="mt-8 text-center text-[10px] text-gray-300">
          Secure digital contract — do not share this link
        </p>
      </div>
    </div>
  )
}
