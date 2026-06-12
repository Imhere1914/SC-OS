/**
 * Ambient animated background — the cinematic aurora behind the app shell.
 *
 * Fixed, behind all app content (negative z), GPU-cheap: 3 large blurred
 * radial-gradient blobs drifting on long eased keyframe loops (transform/opacity
 * only). Brand-cinema aware — SC blobs are tighter / sharper / slightly faster;
 * HFM blobs are larger / softer / slower / organic. Frozen under
 * prefers-reduced-motion (handled in styles.css). Mount once inside the
 * authenticated app shell.
 */
import { useBrand } from '@/contexts/BrandContext'
import { cinema } from '@/lib/brand-cinema'

/**
 * `hero`    — full-strength aurora for the cinematic home / launcher.
 * `ambient` — dimmed (≈55%) so it reads as quiet brand-tinted depth behind
 *             functional screens without ever competing with content.
 */
export type AmbientIntensity = 'hero' | 'ambient'

export function AmbientBackground({ intensity = 'ambient' }: { intensity?: AmbientIntensity } = {}) {
  const brand = useBrand()
  const c = cinema(brand.id)
  const [b1, b2, b3] = c.blobs
  const sharp = c.motion === 'sharp'
  // On inner screens we keep the aurora present but restrained.
  const dim = intensity === 'hero' ? 1 : 0.55

  // Felt-motion differs per brand: SC = tighter/sharper/faster, HFM =
  // larger/softer/slower/organic. We swap blur, size and the animation class.
  const size = sharp ? { a: '46vw', b: '50vw', c: '36vw' } : { a: '60vw', b: '66vw', c: '48vw' }
  const blur = sharp ? { a: '70px', b: '88px', c: '80px' } : { a: '110px', b: '130px', c: '120px' }
  const cls = sharp
    ? { a: 'cine-aurora-sc-1', b: 'cine-aurora-sc-2', c: 'cine-aurora-sc-3' }
    : { a: 'cine-aurora-hfm-1', b: 'cine-aurora-hfm-2', c: 'cine-aurora-hfm-3' }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        // Deep brand-tinted base wash so the blobs read as "alive" not busy.
        // On inner screens the whole layer is dimmed so it stays subtle behind
        // the (glass-veiled) content.
        opacity: dim,
        background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${c.baseBg} ${Math.round(70 * dim)}%, transparent), transparent 72%)`,
      }}
    >
      {/* Blob 1 — primary accent, top-left */}
      <div
        className={`${cls.a} absolute`}
        style={{
          top: '-18%',
          left: '-12%',
          width: size.a,
          height: size.a,
          borderRadius: '9999px',
          filter: `blur(${blur.a})`,
          background: `radial-gradient(circle, color-mix(in srgb, ${b1} ${sharp ? 40 : 34}%, transparent), transparent ${sharp ? 64 : 70}%)`,
        }}
      />
      {/* Blob 2 — secondary accent, bottom-right */}
      <div
        className={`${cls.b} absolute`}
        style={{
          bottom: '-22%',
          right: '-14%',
          width: size.b,
          height: size.b,
          borderRadius: '9999px',
          filter: `blur(${blur.b})`,
          background: `radial-gradient(circle, color-mix(in srgb, ${b2} ${sharp ? 34 : 30}%, transparent), transparent ${sharp ? 66 : 72}%)`,
        }}
      />
      {/* Blob 3 — deep brand tone, center drift */}
      <div
        className={`${cls.c} absolute`}
        style={{
          top: '28%',
          left: '34%',
          width: size.c,
          height: size.c,
          borderRadius: '9999px',
          filter: `blur(${blur.c})`,
          background: `radial-gradient(circle, color-mix(in srgb, ${b3} ${sharp ? 28 : 26}%, transparent), transparent ${sharp ? 68 : 74}%)`,
        }}
      />
    </div>
  )
}
