# Cinematic Layer — "Netflix meets OS"

The ENTRY experience (home + shell + launcher) is cinematic, immersive, alive. Functional screens stay clean tools (DESIGN_LANGUAGE.md) — but you ARRIVE and NAVIGATE through something that feels like a premium operating system crossed with Netflix.

## Mood
Dark, cinematic, premium, spatial. Deep backgrounds, rich brand-accent gradients, soft glow, layering/depth, fluid 60fps motion (transform/opacity only). Always-dark for cinematic surfaces (home, launcher) regardless of the light/dark toggle — like Netflix. Brand accent drives the palette: SC `#2f6df6` (electric blue), HFM `#7c6f9b`/`#a855f7` (violet). Use `brand.accentColor`.

## Signature elements

**Ambient background** — a slow, GPU-cheap animated aurora/mesh-gradient behind cinematic surfaces (2–3 large blurred radial blobs drifting on long ease loops, brand-accent + deep indigo/black). Subtle, never distracting. Honor `prefers-reduced-motion` (freeze it).

**Hero billboard** — full-width, ~42vh, a brand-gradient cinematic backdrop with vignette + soft animated glow. Large greeting + a dynamic headline (the day's most important signal/action) + a primary CTA and a secondary. Think Netflix featured title. Big confident type, tight tracking.

**Content rows (carousels)** — horizontal scroll shelves, each with a row title. Cards are "posters": rounded-2xl, cover (gradient or generated art), title + meta. **Hover → scale ~1.06, lift, glow, reveal a detail overlay** (springy). Scroll-snap, gradient fade masks at both edges, hover-reveal ◂ ▸ arrow controls. Mouse-drag / trackpad / touch scroll all work.

**Card variety by row** — attention cards (alert-tinted, pulse dot), action cards (bold gradient, big icon), module "app" posters (glowing tile), live metric tiles (big number + sparkline-ish bar), record cards (recent contacts/deals).

**OS App Launcher** — full-screen glass overlay (opened via a launcher button + ⌘/ or a key). Large glowing module tiles in a spatial grid, auto-focused search that filters live, keyboard arrow-nav + enter, a "recent" cluster. visionOS / game-console dashboard energy. Esc to close, smooth scale-in.

**Motion** — route content enters with a soft fade+scale+stagger. Card hovers spring. Launcher scales in from center. Everything 150–300ms, eased. Respect `prefers-reduced-motion` (cut to instant).

## Rules
- Cinematic surfaces use their own always-dark palette (don't fight the theme toggle on home/launcher).
- Performance first: animate only transform/opacity; `will-change` sparingly; no layout thrash; lazy where possible.
- Works beautifully with EMPTY data — the wow is design+motion, not data volume. Empty rows show inviting "get started" cards, never blank.
- Keep it tasteful and fast, not gaudy. Netflix is restrained; match that.
