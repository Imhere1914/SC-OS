/**
 * Brand-cinema — the single source of truth for each brand's cinematic identity.
 *
 * Two DISTINCT premium products that share one cinematic language:
 *
 *  • SC  — "Command Center": charcoal + vibrant green / B2B mission-control.
 *          Crisp edges, tighter + slightly faster motion, precise.
 *  • HFM — "Sanctuary": warm brown + olive / holistic wellness.
 *          Rounded bloom, larger + slower + organic motion, breathing.
 *
 * Colours live HERE (typed), never hardcoded in CSS. CSS only owns the
 * brand-agnostic `cine-*` keyframes; brand colours are driven via inline
 * style / CSS vars sourced from this module. Default (non-branded) = SC charcoal.
 */

export type CinemaMotion = 'sharp' | 'organic'

export interface CinemaPalette {
  /** Primary brand accent. */
  accent: string
  /** Secondary accent — pairs with `accent` in the gradient. */
  accent2: string
  /** Primary brand gradient (135deg accent → accent2). */
  gradient: string
  /** Cinematic always-dark base background. */
  baseBg: string
  /** Cinematic surface (cards / glass panels). */
  surface: string
  /** Glow / bloom colour. */
  glow: string
  /** Three ambient aurora blob colours. */
  blobs: [string, string, string]
  /** Felt-motion character — drives drift speed/scale/blur per brand. */
  motion: CinemaMotion
  /** Human-readable mood label. */
  moodLabel: string
}

const SC: CinemaPalette = {
  accent: '#22c55e',
  accent2: '#4ade80',
  gradient: 'linear-gradient(135deg,#22c55e,#4ade80)',
  baseBg: '#0f1210',
  surface: '#171c18',
  glow: '#22c55e',
  blobs: ['#22c55e', '#4ade80', '#15803d'],
  motion: 'sharp',
  moodLabel: 'Command Center',
}

const HFM: CinemaPalette = {
  accent: '#a3843b',
  accent2: '#8b9a3c',
  gradient: 'linear-gradient(135deg,#a3843b,#8b9a3c)',
  baseBg: '#141110',
  surface: '#1d1915',
  glow: '#a3843b',
  blobs: ['#a3843b', '#8b9a3c', '#6b5b33'],
  motion: 'organic',
  moodLabel: 'Sanctuary',
}

const PALETTES: Record<string, CinemaPalette> = {
  sc: SC,
  hfm: HFM,
  default: SC,
}

/** Resolve a brand's full cinematic palette. Unknown ids fall back to SC-blue. */
export function cinema(brandId: string): CinemaPalette {
  return PALETTES[brandId] ?? PALETTES.default
}
