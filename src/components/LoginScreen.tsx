import { useState, type CSSProperties } from 'react'
import { useBrand } from '@/contexts/BrandContext'
import { cinema } from '@/lib/brand-cinema'

/**
 * Full-screen cinematic login gate. Rendered by __root.tsx instead of the app
 * shell when auth is enabled and there is no valid session.
 *
 * Brand-embodying: a full-bleed always-dark aurora backdrop in the brand's
 * felt-motion character (SC sharp/electric "Command Center", HFM soft/organic
 * "Sanctuary"), behind a premium glass card with a glowing brand orb. ALL
 * colours derive from `cinema(brand.id)` — never hardcoded brand hues.
 *
 * The auth logic (POST /api/auth/login, reload-on-success, error handling) is
 * unchanged — only the visual presentation differs.
 */
export function LoginScreen() {
  const brand = useBrand()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (loading || !email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (res.ok) {
        // Reload to rehydrate everything with the authenticated session
        window.location.reload()
        return
      }
      setError(res.status === 429 ? 'Too many attempts. Try again later.' : 'Invalid credentials')
      setLoading(false)
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  // ── Brand cinematic identity ──────────────────────────────────────
  const c = cinema(brand.id)
  const [b1, b2, b3] = c.blobs
  const sharp = c.motion === 'sharp'

  // SC = crisp/electric (sharper edges, faster), HFM = warm/soft (rounder, slower).
  const cardRadius = sharp ? '20px' : '30px'
  const tagline = brand.id === 'hfm' ? 'Your practice, in harmony.' : 'Your operating system.'

  // Brand vars consumed by the namespaced cine-login-* CSS (focus glow, press, etc.).
  const rootVars = {
    '--cine-glow': c.glow,
    '--cine-gradient': c.gradient,
  } as CSSProperties

  // Aurora blob motion classes — reuse the same felt-motion as AmbientBackground.
  const auroraCls = sharp
    ? { a: 'cine-aurora-sc-1', b: 'cine-aurora-sc-2', c: 'cine-aurora-sc-3' }
    : { a: 'cine-aurora-hfm-1', b: 'cine-aurora-hfm-2', c: 'cine-aurora-hfm-3' }
  const size = sharp ? { a: '52vw', b: '56vw', c: '40vw' } : { a: '66vw', b: '72vw', c: '54vw' }
  const blur = sharp ? { a: '80px', b: '96px', c: '88px' } : { a: '120px', b: '140px', c: '130px' }

  const inputStyle: CSSProperties = {
    background: 'color-mix(in srgb, #ffffff 4%, transparent)',
    borderColor: 'color-mix(in srgb, #ffffff 12%, transparent)',
    color: '#f4f6fb',
  }

  return (
    <div
      className="relative flex h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: c.baseBg, ...rootVars }}
    >
      {/* ── Full-bleed cinematic aurora backdrop ─────────────────── */}
      <div
        aria-hidden
        className="cine-login-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Deep brand-tinted base wash */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 110% at 50% -10%, color-mix(in srgb, ${c.glow} ${sharp ? 14 : 12}%, transparent), transparent 65%)`,
          }}
        />
        {/* Blob 1 — primary accent */}
        <div
          className={`${auroraCls.a} absolute`}
          style={{
            top: '-20%',
            left: '-14%',
            width: size.a,
            height: size.a,
            borderRadius: '9999px',
            filter: `blur(${blur.a})`,
            background: `radial-gradient(circle, color-mix(in srgb, ${b1} ${sharp ? 42 : 36}%, transparent), transparent ${sharp ? 64 : 70}%)`,
          }}
        />
        {/* Blob 2 — secondary accent */}
        <div
          className={`${auroraCls.b} absolute`}
          style={{
            bottom: '-24%',
            right: '-16%',
            width: size.b,
            height: size.b,
            borderRadius: '9999px',
            filter: `blur(${blur.b})`,
            background: `radial-gradient(circle, color-mix(in srgb, ${b2} ${sharp ? 36 : 32}%, transparent), transparent ${sharp ? 66 : 72}%)`,
          }}
        />
        {/* Blob 3 — deep brand tone */}
        <div
          className={`${auroraCls.c} absolute`}
          style={{
            top: '30%',
            left: '36%',
            width: size.c,
            height: size.c,
            borderRadius: '9999px',
            filter: `blur(${blur.c})`,
            background: `radial-gradient(circle, color-mix(in srgb, ${b3} ${sharp ? 30 : 28}%, transparent), transparent ${sharp ? 68 : 74}%)`,
          }}
        />
        {/* SC-only subtle scanline tech grid — crisp command-center accent */}
        {sharp && (
          <div className="cine-login-scanlines absolute inset-0 opacity-[0.35]" />
        )}
        {/* Vignette to anchor the card */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 50% 45%, transparent 40%, color-mix(in srgb, ${c.baseBg} 88%, #000) 100%)`,
          }}
        />
      </div>

      {/* ── Premium glass login card ─────────────────────────────── */}
      <div
        className="cine-login-card relative w-full max-w-sm border p-8 sm:p-9"
        style={{
          borderRadius: cardRadius,
          background: `linear-gradient(160deg, color-mix(in srgb, ${c.surface} 78%, transparent), color-mix(in srgb, ${c.baseBg} 86%, transparent))`,
          backdropFilter: 'blur(22px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
          borderColor: `color-mix(in srgb, ${c.glow} 28%, transparent)`,
          boxShadow: `0 24px 70px -24px color-mix(in srgb, ${c.glow} 45%, transparent), 0 1px 0 0 color-mix(in srgb, #ffffff 10%, transparent) inset`,
        }}
      >
        {/* Hairline brand-glow top highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${c.glow} 70%, transparent), transparent)` }}
        />

        <div className="mb-7 flex flex-col items-center text-center">
          {/* Glowing brand orb / logo lockup */}
          <div className="relative mb-4 flex items-center justify-center">
            <div
              aria-hidden
              data-motion={c.motion}
              className="cine-login-orb-glow absolute"
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '9999px',
                filter: 'blur(14px)',
                background: c.gradient,
              }}
            />
            <div
              className="relative flex items-center justify-center text-[18px] font-bold tracking-tight text-white"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: sharp ? '18px' : '9999px',
                background: c.gradient,
                boxShadow: `0 6px 24px -6px color-mix(in srgb, ${c.glow} 70%, transparent), 0 0 0 1px color-mix(in srgb, #ffffff 18%, transparent) inset`,
              }}
            >
              {brand.shortName}
            </div>
          </div>

          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: '#f6f8fc' }}
          >
            {brand.name}
          </h1>
          <p
            className="mt-1 text-[13px]"
            style={{ color: 'color-mix(in srgb, #ffffff 58%, transparent)' }}
          >
            {tagline}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit() }}
            placeholder="Email"
            autoFocus
            className="cine-login-input w-full rounded-xl border px-3.5 py-2.5 text-[13px] placeholder:text-white/40 focus:outline-none"
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit() }}
            placeholder="Password"
            className="cine-login-input w-full rounded-xl border px-3.5 py-2.5 text-[13px] placeholder:text-white/40 focus:outline-none"
            style={inputStyle}
          />
          {error && (
            <p
              className="rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{
                color: '#ffb4b4',
                background: 'color-mix(in srgb, #ef4444 14%, transparent)',
                border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
              }}
            >
              {error}
            </p>
          )}
          <button
            onClick={() => void submit()}
            disabled={loading || !email.trim() || !password}
            className="cine-login-btn mt-1 w-full rounded-xl py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            style={{
              background: c.gradient,
              boxShadow: `0 6px 20px -8px color-mix(in srgb, ${c.glow} 60%, transparent)`,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>

        {/* Footer brand line */}
        <p
          className="mt-7 text-center text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: 'color-mix(in srgb, #ffffff 32%, transparent)' }}
        >
          Powered by Hermes
        </p>
      </div>
    </div>
  )
}
