# Hermes OS — Design Language

The product must feel like an **agentic operating system**: alive, glassy, confident — never a generic admin panel.
Reference implementations (read these before styling anything):
- `src/screens/dashboard/mission-control.tsx` — flagship
- `src/screens/accounting/payroll-screen.tsx` + `src/screens/payments/payments-screen.tsx` — the modernized standard
- `src/routes/__root.tsx` — the OS shell (sidebar dock, Hermes orb)

## Tokens & primitives

- Theme tokens ONLY: `var(--theme-accent|card|border|muted|text|hover|input|success)`. No hardcoded surfaces.
- Brand accent: `const brand = useBrand()` → `brand.accentColor`.
- Gradient icon chip: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #7b3fe4))` + soft glow `boxShadow: 0 2px 8px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`.
- Status colors: green `#10b981`, blue `#3b82f6`, amber `#f59e0b`, red `#ef4444`, purple `#8b5cf6`, sky `#0ea5e9`, orange `#f97316`.

## Patterns

**Stat card**: rounded-xl, `var(--theme-card)` bg, 1px border, thin colored LEFT accent bar, gradient icon chip top-left,
uppercase tracking-wide 10-11px muted label, large bold tabular-nums value, small muted sublabel, hover lift
(`hover: translateY(-1px)`, border→accent tint, transition-all duration-150), `backdropFilter: blur(10px)`.

**Status badge**: colored dot + tinted pill — bg `color-mix(in srgb, <color> 12%, var(--theme-card))`, text in the color,
10-11px font-medium. Never plain text statuses.

**Segmented control** (filter tabs): single rounded-lg bordered container, items as buttons; active = accent-tinted bg +
accent text; counts in tabular-nums muted.

**Tables**: tinted header row (uppercase 10px tracking-wider muted), row hover highlight, money right-aligned
tabular-nums, actions as ghost icon buttons revealed on row hover (`opacity-0 group-hover:opacity-100`, keep
`focus-within` visible for a11y).

**Empty state**: centered icon inside a soft gradient circle, semibold title, muted subtitle, gradient CTA button.

**Loading**: skeleton blocks (`animate-pulse`, rounded, `var(--theme-card)` at ~60% opacity) shaped like the real
content. Never "Loading…" text, never blank.

**Modals**: header = gradient icon chip + bold title + muted subtitle; uppercase section labels; primary button =
gradient + glow; backdrop `bg-black/40 backdrop-blur-sm`.

**Section headers** in-page: 10-11px uppercase tracking-wider muted, optionally with a "View all →" link right-aligned.

**Page header**: gradient icon chip + bold 18-20px title + muted subtitle line (counts/context), primary action top-right.

**Money**: tabular-nums everywhere; positive/paid green, overdue/negative red; large where it's the point.

**Motion**: transition-all duration-150 on interactives; `breathe`/`fadeSlideIn` keyframes exist in styles.css;
respect `prefers-reduced-motion`.

## Hard rules

1. RESTYLE ONLY — never change queries, mutations, endpoints, handlers, state shape, or form fields.
2. Icons must exist in `node_modules/@hugeicons/core-free-icons/dist/types/index.d.ts` — verify before importing.
3. Toast API: `toast(msg)` / `toast(msg, { type: 'error' })` only.
4. TypeScript strict: zero unused imports/variables. `npm run build` must pass.
5. Both light and dark themes must remain legible — tokens handle this; don't fight them.
