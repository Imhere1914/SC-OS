import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { seedWellnessSessions } from '../lib/wellness-seed'
import { seedActionTasks } from '../lib/wellness-actions-seed'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown) {
  const p = dbPath(file)
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type CardType = 'teach' | 'list' | 'quiz' | 'truefalse' | 'reflect' | 'tip' | 'complete'

export interface WellnessCard {
  id: string
  type: CardType
  // teach: heading, body (may contain \n\n-separated paragraphs), image_url?, key_points?
  // list: heading, intro?, variant?, items[]  (each item often "Name — short why")
  // quiz: question, options string[], correct_index number, explanation
  // truefalse: statement, is_true boolean, explanation
  // reflect: prompt, placeholder?
  // tip: heading, body, habit?  (a tiny actionable micro-habit)
  // complete: takeaway, affirmation?
  heading?: string; body?: string; image_url?: string
  key_points?: string[]                        // teach: bullet takeaways under the body
  intro?: string                               // list: a sentence above the items
  variant?: 'good' | 'avoid' | 'neutral'       // list: styling
  items?: string[]                             // list: each item
  question?: string; options?: string[]; correct_index?: number; explanation?: string
  statement?: string; is_true?: boolean
  prompt?: string; placeholder?: string
  habit?: string; takeaway?: string; affirmation?: string
}

export interface WellnessCategory { key: string; name: string; tagline: string; emoji: string; color: string; order: number }

export interface WellnessSession {
  id: string; brand: string; category_key: string
  title: string; subtitle: string; order: number
  est_minutes: number; points: number
  status: 'draft' | 'published'
  cards: WellnessCard[]
  // Daily-plan metadata (optional, default-safe; backfilled via migrateSessionMeta).
  difficulty?: 1 | 2 | 3            // 1 foundational, 2 building, 3 thriving
  focus_areas?: string[]            // e.g. ['blood-sugar','pcos','heart','gut','hormones','energy','stress','sleep']
  created_at: string; updated_at: string
}

// ── Daily action tasks ───────────────────────────────────────────────────────────

export type ActionDimension = 'movement' | 'nutrition' | 'hydration' | 'sleep' | 'mindset'

export interface ActionTask {
  id: string; dimension: ActionDimension; title: string; description: string
  difficulty: 1 | 2 | 3
  target?: { value: number; unit: string }   // e.g. {value:10,unit:'min'} — scales with difficulty
  focus_areas?: string[]
}

export interface DailyPlanItem {
  kind: 'lesson' | 'action'
  ref_id: string                  // session id (lesson) or action task id (action)
  dimension?: ActionDimension     // for action items
  category_key?: string           // for lesson items
  title: string
  done: boolean
}

export interface DailyPlan {
  date: string                    // YYYY-MM-DD
  items: DailyPlanItem[]
  completed: boolean
  completed_at?: string
}

export interface WellnessProgress {
  id: string; brand: string; token: string
  patient_name?: string; patient_email?: string
  streak_days: number; longest_streak: number; last_completed_date?: string // YYYY-MM-DD
  total_points: number; total_sessions: number
  category_progress: Record<string, { completed_session_ids: string[]; level: number; points: number }>
  completed_session_ids: string[]
  reflections: Record<string, string> // card_id -> text
  // Daily-plan engine fields (default-safe for existing records).
  level: number                   // drives difficulty; default 1
  focus_area?: string             // patient-chosen wellness track, optional
  daily_plan?: DailyPlan
  plan_history?: string[]         // dates (YYYY-MM-DD) on which the daily plan was completed
  // Streak-freeze layer (default-safe for existing records).
  freezes?: number                // banked freezes, max 2 (default 0)
  freezes_earned_total?: number   // lifetime freezes awarded
  freeze_covered_date?: string    // YYYY-MM-DD a freeze was last consumed to cover a miss (idempotency guard)
  freeze_used_notice?: boolean    // transient one-time flag for the UI; cleared after the plan is fetched
  // Daily-reminder layer.
  reminder_email_opt_in?: boolean
  reminder_email?: string         // defaults to patient_email
  reminder_last_sent_date?: string // YYYY-MM-DD a reminder was last sent to this patient
  started_at: string; last_active_at: string
}

// ── Categories ──────────────────────────────────────────────────────────────────

export const CATEGORIES: WellnessCategory[] = [
  { key: 'hormone-harmony', name: 'Hormone Harmony', tagline: 'Work with your cycle, not against it', emoji: '🌸', color: '#ec4899', order: 0 },
  { key: 'gut-glow', name: 'Gut & Glow', tagline: 'Where digestion meets radiance', emoji: '🌿', color: '#10b981', order: 1 },
  { key: 'energy-vitality', name: 'Energy & Vitality', tagline: 'Feel awake, alive, and steady', emoji: '⚡', color: '#f59e0b', order: 2 },
  { key: 'nourish', name: 'Nourish', tagline: 'Food as gentle medicine', emoji: '🥗', color: '#84cc16', order: 3 },
  { key: 'mind-mood', name: 'Mind & Mood', tagline: 'Calm the nervous system, lift the spirit', emoji: '🧠', color: '#8b5cf6', order: 4 },
  { key: 'rest-restore', name: 'Rest & Restore', tagline: 'Sleep that truly repairs', emoji: '🌙', color: '#3b82f6', order: 5 },
  { key: 'inner-balance', name: 'Inner Balance', tagline: 'The whole-person thread', emoji: '✨', color: '#14b8a6', order: 6 },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString() }

function sessionsFile(brand: string) { return `wellness-sessions-${brand}.json` }
function progressFile(brand: string) { return `wellness-progress-${brand}.json` }

// ── Sessions: seed-on-first-access + CRUD ───────────────────────────────────────

// Auto-seed runs ONLY when the seed marker file is absent — once real content is
// loaded (via the admin API), we never re-inject the starter set, even if the
// practitioner deletes everything. The marker is written on first seed.
function readSessions(brand: string): WellnessSession[] {
  const data = readJson<WellnessSession[]>(sessionsFile(brand), [])
  if (brand === 'hfm' && data.length === 0 && !existsSync(sessionsFile(brand) + '.seeded')) {
    const now = nowISO()
    const seeded: WellnessSession[] = seedWellnessSessions().map(s => ({
      ...s,
      id: nanoid(),
      brand: 'hfm',
      created_at: now,
      updated_at: now,
    }))
    writeJson(sessionsFile(brand), seeded)
    writeFileSync(sessionsFile(brand) + '.seeded', now)
    return seeded
  }
  return data
}

function writeSessions(brand: string, sessions: WellnessSession[]) {
  writeJson(sessionsFile(brand), sessions)
}

// ── Session metadata derivation + migration ─────────────────────────────────────

/** Map session order (0-based or 1-based) to a difficulty tier. */
export function difficultyForOrder(order: number): 1 | 2 | 3 {
  // order 1–2 → 1, order 3–4 → 2, order 5 → 3. Seed orders are 0-based, so normalize.
  const o = order + 1
  if (o <= 2) return 1
  if (o <= 4) return 2
  return 3
}

/** Derive focus_areas from a session's category + title keywords. */
export function focusAreasForSession(categoryKey: string, title: string): string[] {
  const areas = new Set<string>()
  const t = title.toLowerCase()

  // Category-based defaults.
  switch (categoryKey) {
    case 'hormone-harmony': areas.add('hormones'); areas.add('pcos'); break
    case 'gut-glow': areas.add('gut'); break
    case 'energy-vitality': areas.add('energy'); break
    case 'nourish': areas.add('blood-sugar'); break
    case 'mind-mood': areas.add('stress'); break
    case 'rest-restore': areas.add('sleep'); break
    case 'inner-balance': areas.add('stress'); break
  }

  // Title keyword overrides/additions.
  if (t.includes('blood sugar') || t.includes('protein') || t.includes('balanced plate') || t.includes('rainbow')) areas.add('blood-sugar')
  if (t.includes('blood pressure') || t.includes('heart')) areas.add('heart')
  if (t.includes('gut') || t.includes('fiber') || t.includes('digest')) areas.add('gut')
  if (t.includes('cycle') || t.includes('pcos') || t.includes('hormone')) { areas.add('hormones'); areas.add('pcos') }
  if (t.includes('stress') || t.includes('cortisol') || t.includes('breath') || t.includes('nervous')) areas.add('stress')
  if (t.includes('sleep') || t.includes('wind-down') || t.includes('screen')) areas.add('sleep')
  if (t.includes('hydrat') || t.includes('water')) areas.add('energy')

  return [...areas]
}

/**
 * Backfill difficulty + focus_areas onto stored sessions that are missing them.
 * Idempotent — only fills gaps, never overwrites existing values. Returns count updated.
 */
export function migrateSessionMeta(brand: string): number {
  const sessions = readSessions(brand)
  let changed = 0
  for (const s of sessions) {
    let touched = false
    if (s.difficulty === undefined) { s.difficulty = difficultyForOrder(s.order); touched = true }
    if (s.focus_areas === undefined) { s.focus_areas = focusAreasForSession(s.category_key, s.title); touched = true }
    if (touched) { s.updated_at = nowISO(); changed += 1 }
  }
  if (changed > 0) writeSessions(brand, sessions)
  return changed
}

export function listCategories(): WellnessCategory[] {
  return [...CATEGORIES].sort((a, b) => a.order - b.order)
}

// ── Action-task library ──────────────────────────────────────────────────────────

let _actionCache: ActionTask[] | null = null

export function listActions(): ActionTask[] {
  if (!_actionCache) _actionCache = seedActionTasks()
  return _actionCache
}

export function actionsByDimension(dimension: ActionDimension): ActionTask[] {
  return listActions().filter(a => a.dimension === dimension)
}

/** Pick one action for a dimension at (or nearest below) the target difficulty,
 *  weighting toward focus_area, avoiding ids in `exclude`, rotating by `seed`. */
function pickAction(
  dimension: ActionDimension,
  difficulty: 1 | 2 | 3,
  focusArea: string | undefined,
  exclude: Set<string>,
  seed: number,
): ActionTask | null {
  const pool = actionsByDimension(dimension).filter(a => !exclude.has(a.id))
  if (pool.length === 0) return null
  // Prefer exact difficulty, then any difficulty <= target, then anything.
  const tiers = [
    pool.filter(a => a.difficulty === difficulty),
    pool.filter(a => a.difficulty <= difficulty),
    pool,
  ]
  for (const tier of tiers) {
    if (tier.length === 0) continue
    const weighted = focusArea
      ? [...tier.filter(a => a.focus_areas?.includes(focusArea)), ...tier.filter(a => !a.focus_areas?.includes(focusArea))]
      : tier
    return weighted[seed % weighted.length]
  }
  return null
}

export function listSessions(brand: string, opts: { category?: string; status?: string } = {}): WellnessSession[] {
  let sessions = readSessions(brand)
  if (opts.category) sessions = sessions.filter(s => s.category_key === opts.category)
  if (opts.status) sessions = sessions.filter(s => s.status === opts.status)
  return sessions.sort((a, b) => a.order - b.order)
}

export function getSession(brand: string, id: string): WellnessSession | null {
  return readSessions(brand).find(s => s.id === id) ?? null
}

export function createSession(brand: string, data: Partial<WellnessSession>): WellnessSession {
  const now = nowISO()
  const session: WellnessSession = {
    id: nanoid(),
    brand,
    category_key: data.category_key ?? CATEGORIES[0].key,
    title: data.title ?? 'Untitled Session',
    subtitle: data.subtitle ?? '',
    order: data.order ?? readSessions(brand).filter(s => s.category_key === (data.category_key ?? CATEGORIES[0].key)).length,
    est_minutes: data.est_minutes ?? 6,
    points: data.points ?? 50,
    status: 'draft',
    cards: data.cards ?? [],
    created_at: now,
    updated_at: now,
  }
  const sessions = readSessions(brand)
  sessions.push(session)
  writeSessions(brand, sessions)
  return session
}

export function updateSession(brand: string, id: string, data: Partial<WellnessSession>): WellnessSession | null {
  const sessions = readSessions(brand)
  const idx = sessions.findIndex(s => s.id === id)
  if (idx === -1) return null
  const updated = { ...sessions[idx], ...data, id, brand, updated_at: nowISO() }
  sessions[idx] = updated
  writeSessions(brand, sessions)
  return updated
}

export function deleteSession(brand: string, id: string): boolean {
  const sessions = readSessions(brand)
  const len = sessions.length
  const filtered = sessions.filter(s => s.id !== id)
  if (filtered.length === len) return false
  writeSessions(brand, filtered)
  return true
}

export function publishSession(brand: string, id: string): WellnessSession | null {
  return updateSession(brand, id, { status: 'published' })
}

export function unpublishSession(brand: string, id: string): WellnessSession | null {
  return updateSession(brand, id, { status: 'draft' })
}

// ── Cards ────────────────────────────────────────────────────────────────────

export function addCard(brand: string, sessionId: string, card: Partial<WellnessCard>): WellnessSession | null {
  const sessions = readSessions(brand)
  const idx = sessions.findIndex(s => s.id === sessionId)
  if (idx === -1) return null
  const newCard: WellnessCard = {
    id: card.id ?? nanoid(),
    type: card.type ?? 'teach',
    heading: card.heading, body: card.body, image_url: card.image_url,
    key_points: card.key_points,
    intro: card.intro, variant: card.variant, items: card.items,
    question: card.question, options: card.options, correct_index: card.correct_index, explanation: card.explanation,
    statement: card.statement, is_true: card.is_true,
    prompt: card.prompt, placeholder: card.placeholder,
    habit: card.habit, takeaway: card.takeaway, affirmation: card.affirmation,
  }
  sessions[idx].cards.push(newCard)
  sessions[idx].updated_at = nowISO()
  writeSessions(brand, sessions)
  return sessions[idx]
}

export function updateCard(brand: string, sessionId: string, cardId: string, data: Partial<WellnessCard>): WellnessSession | null {
  const sessions = readSessions(brand)
  const sIdx = sessions.findIndex(s => s.id === sessionId)
  if (sIdx === -1) return null
  const cIdx = sessions[sIdx].cards.findIndex(card => card.id === cardId)
  if (cIdx === -1) return null
  sessions[sIdx].cards[cIdx] = { ...sessions[sIdx].cards[cIdx], ...data, id: cardId }
  sessions[sIdx].updated_at = nowISO()
  writeSessions(brand, sessions)
  return sessions[sIdx]
}

export function removeCard(brand: string, sessionId: string, cardId: string): WellnessSession | null {
  const sessions = readSessions(brand)
  const sIdx = sessions.findIndex(s => s.id === sessionId)
  if (sIdx === -1) return null
  sessions[sIdx].cards = sessions[sIdx].cards.filter(card => card.id !== cardId)
  sessions[sIdx].updated_at = nowISO()
  writeSessions(brand, sessions)
  return sessions[sIdx]
}

export function reorderCards(brand: string, sessionId: string, orderedIds: string[]): WellnessSession | null {
  const sessions = readSessions(brand)
  const sIdx = sessions.findIndex(s => s.id === sessionId)
  if (sIdx === -1) return null
  const cardMap = new Map(sessions[sIdx].cards.map(card => [card.id, card]))
  sessions[sIdx].cards = orderedIds
    .map(id => cardMap.get(id))
    .filter((card): card is WellnessCard => card !== undefined)
  sessions[sIdx].updated_at = nowISO()
  writeSessions(brand, sessions)
  return sessions[sIdx]
}

// ── Progress ────────────────────────────────────────────────────────────────────

function readProgress(brand: string): WellnessProgress[] {
  return readJson<WellnessProgress[]>(progressFile(brand), [])
}

function writeProgress(brand: string, progress: WellnessProgress[]) {
  writeJson(progressFile(brand), progress)
}

function emptyProgress(brand: string, token: string, name?: string, email?: string): WellnessProgress {
  const now = nowISO()
  return {
    id: nanoid(),
    brand,
    token,
    patient_name: name,
    patient_email: email,
    streak_days: 0,
    longest_streak: 0,
    total_points: 0,
    total_sessions: 0,
    category_progress: {},
    completed_session_ids: [],
    reflections: {},
    level: 1,
    plan_history: [],
    freezes: 0,
    freezes_earned_total: 0,
    started_at: now,
    last_active_at: now,
  }
}

/** Backfill default-safe daily-plan fields onto progress records that predate them. */
function normalizeProgress(p: WellnessProgress): WellnessProgress {
  if (typeof p.level !== 'number') p.level = 1
  if (!Array.isArray(p.plan_history)) p.plan_history = []
  if (typeof p.freezes !== 'number') p.freezes = 0
  if (typeof p.freezes_earned_total !== 'number') p.freezes_earned_total = 0
  return p
}

const MAX_BANKED_FREEZES = 2

/**
 * Streak protection — runs idempotently at plan-fetch time. If the patient MISSED
 * yesterday (their last completed plan date is 2+ days before today) but they have a
 * banked freeze AND an active streak, consume one freeze to PRESERVE the streak rather
 * than letting it reset. Records the covered date so a freeze is never double-consumed
 * for the same gap, and sets a transient `freeze_used_notice` flag for the UI.
 *
 * Mutates `progress` in place. Returns true if a freeze was consumed (caller persists).
 */
function applyStreakProtection(progress: WellnessProgress, todayISO: string): boolean {
  // No streak to protect, or nothing banked → nothing to do.
  if (progress.streak_days <= 0 || (progress.freezes ?? 0) <= 0) return false
  const last = progress.last_completed_date
  if (!last) return false
  // Already completed today or yesterday → not a miss, streak is intact.
  if (last === todayISO || last === isoYesterday(todayISO)) return false
  // Idempotency: only cover a given gap once per day.
  if (progress.freeze_covered_date === todayISO) return false

  // The patient missed at least one full day. Spend a freeze to bridge the gap so the
  // streak survives: treat the missed day(s) as "covered" up to yesterday.
  progress.freezes = (progress.freezes ?? 0) - 1
  progress.freeze_covered_date = todayISO
  progress.last_completed_date = isoYesterday(todayISO) // streak now continues from yesterday
  progress.freeze_used_notice = true
  return true
}

export function getProgress(brand: string, token: string): WellnessProgress {
  const all = readProgress(brand)
  const found = all.find(p => p.token === token)
  if (found) return normalizeProgress(found)
  return emptyProgress(brand, token)
}

export function getOrCreateProgress(brand: string, token: string, name?: string, email?: string): WellnessProgress {
  const all = readProgress(brand)
  const found = all.find(p => p.token === token)
  if (found) {
    normalizeProgress(found)
    let changed = false
    if (name && found.patient_name !== name) { found.patient_name = name; changed = true }
    if (email && found.patient_email !== email) { found.patient_email = email; changed = true }
    if (changed) {
      found.last_active_at = nowISO()
      writeProgress(brand, all)
    }
    return found
  }
  const created = emptyProgress(brand, token, name, email)
  all.push(created)
  writeProgress(brand, all)
  return created
}

function isoYesterday(todayISO: string): string {
  const d = new Date(todayISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export interface CompleteResult {
  progress: WellnessProgress
  earned: { points: number; streak_days: number; leveled_up: boolean; category_key: string; new_level: number }
}

export function completeSession(
  brand: string,
  token: string,
  sessionId: string,
  todayISO: string,
  reflections?: Record<string, string>,
): CompleteResult | null {
  const session = getSession(brand, sessionId)
  if (!session) return null

  const all = readProgress(brand)
  let progress = all.find(p => p.token === token)
  if (!progress) {
    progress = emptyProgress(brand, token)
    all.push(progress)
  }

  const catKey = session.category_key
  const cat = progress.category_progress[catKey] ?? { completed_session_ids: [], level: 1, points: 0 }
  const prevLevel = cat.level

  // Already completed → no double credit, but still merge reflections.
  if (progress.completed_session_ids.includes(sessionId)) {
    if (reflections) {
      progress.reflections = { ...progress.reflections, ...reflections }
      progress.last_active_at = nowISO()
      writeProgress(brand, all)
    }
    return {
      progress,
      earned: { points: 0, streak_days: progress.streak_days, leveled_up: false, category_key: catKey, new_level: cat.level },
    }
  }

  // Streak logic.
  if (progress.last_completed_date === todayISO) {
    // unchanged
  } else if (progress.last_completed_date === isoYesterday(todayISO)) {
    progress.streak_days += 1
  } else {
    progress.streak_days = 1
  }
  progress.longest_streak = Math.max(progress.longest_streak, progress.streak_days)
  progress.last_completed_date = todayISO

  // Points + counts.
  progress.total_points += session.points
  progress.total_sessions += 1
  progress.completed_session_ids.push(sessionId)

  // Category progress + level.
  cat.completed_session_ids.push(sessionId)
  cat.points += session.points
  cat.level = Math.floor(cat.completed_session_ids.length / 3) + 1
  progress.category_progress[catKey] = cat

  // Reflections.
  if (reflections) progress.reflections = { ...progress.reflections, ...reflections }

  progress.last_active_at = nowISO()
  writeProgress(brand, all)

  return {
    progress,
    earned: {
      points: session.points,
      streak_days: progress.streak_days,
      leveled_up: cat.level > prevLevel,
      category_key: catKey,
      new_level: cat.level,
    },
  }
}

export function getNextSession(brand: string, token: string): WellnessSession | null {
  const published = readSessions(brand).filter(s => s.status === 'published')
  if (published.length === 0) return null

  const progress = readProgress(brand).find(p => p.token === token)
  const completed = new Set(progress?.completed_session_ids ?? [])
  const remaining = published.filter(s => !completed.has(s.id))
  if (remaining.length === 0) return null

  // Prefer the category with the fewest completions for variety.
  const completedCountByCat = new Map<string, number>()
  for (const cat of CATEGORIES) {
    completedCountByCat.set(cat.key, progress?.category_progress[cat.key]?.completed_session_ids.length ?? 0)
  }

  remaining.sort((a, b) => {
    const ca = completedCountByCat.get(a.category_key) ?? 0
    const cb = completedCountByCat.get(b.category_key) ?? 0
    if (ca !== cb) return ca - cb
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title)
  })

  return remaining[0]
}

// ── Focus-area wellness-support tracks ───────────────────────────────────────────

export interface FocusAreaTrack { key: string; label: string; emoji: string }

/** Wellness-support tracks — GENERAL lifestyle-habit themes broadly supportive of
 *  these areas. NOT diagnosis, treatment, or condition management. */
export const FOCUS_AREA_TRACKS: FocusAreaTrack[] = [
  { key: 'general', label: 'General Wellness', emoji: '✨' },
  { key: 'blood-sugar', label: 'Blood Sugar Wellness', emoji: '🩸' },
  { key: 'heart', label: 'Heart & Pressure Wellness', emoji: '❤️' },
  { key: 'pcos', label: 'Cycle & PCOS Wellness', emoji: '🌸' },
  { key: 'gut', label: 'Gut Wellness', emoji: '🌿' },
]

export function listFocusAreas(): FocusAreaTrack[] {
  return FOCUS_AREA_TRACKS
}

function isValidFocusArea(key: string): boolean {
  return FOCUS_AREA_TRACKS.some(t => t.key === key)
}

export function setFocusArea(brand: string, token: string, focusArea: string | null): WellnessProgress {
  const all = readProgress(brand)
  let progress = all.find(p => p.token === token)
  if (!progress) { progress = emptyProgress(brand, token); all.push(progress) }
  normalizeProgress(progress)
  if (focusArea === null || focusArea === 'general' || focusArea === '') {
    delete progress.focus_area
  } else if (isValidFocusArea(focusArea)) {
    progress.focus_area = focusArea
  }
  progress.last_active_at = nowISO()
  writeProgress(brand, all)
  return progress
}

// ── Reminder preferences ─────────────────────────────────────────────────────────

export function setReminderPrefs(
  brand: string,
  token: string,
  optIn: boolean,
  email?: string,
): WellnessProgress {
  const all = readProgress(brand)
  let progress = all.find(p => p.token === token)
  if (!progress) { progress = emptyProgress(brand, token); all.push(progress) }
  normalizeProgress(progress)
  progress.reminder_email_opt_in = optIn
  const trimmed = email?.trim()
  if (trimmed) {
    progress.reminder_email = trimmed
    if (!progress.patient_email) progress.patient_email = trimmed
  } else if (!progress.reminder_email && progress.patient_email) {
    progress.reminder_email = progress.patient_email
  }
  progress.last_active_at = nowISO()
  writeProgress(brand, all)
  return progress
}

/** Read all progress records for a brand (used by the reminder scheduler). */
export function listProgress(brand: string): WellnessProgress[] {
  return readProgress(brand).map(normalizeProgress)
}

/** Mark a reminder as sent today for a patient (persists the marker). */
export function markReminderSent(brand: string, token: string, dateISO: string): void {
  const all = readProgress(brand)
  const progress = all.find(p => p.token === token)
  if (!progress) return
  progress.reminder_last_sent_date = dateISO
  writeProgress(brand, all)
}

// ── Daily Plan engine ────────────────────────────────────────────────────────────

/** Level rises one tier every 5 completed daily plans, capped at 3. */
function levelFromHistory(planHistory: string[]): number {
  return Math.min(3, Math.floor((planHistory.length ?? 0) / 5) + 1)
}

/** Day-of-epoch number — used to rotate dimension selection day to day. */
function dayNumber(dateISO: string): number {
  return Math.floor(new Date(dateISO + 'T00:00:00Z').getTime() / 86_400_000)
}

const DIMENSION_ROTATION: ActionDimension[] = ['movement', 'nutrition', 'hydration', 'sleep', 'mindset']

/** Pick the next uncompleted published lesson at difficulty <= level, weighting toward
 *  focus_area and rotating categories for variety. */
function pickLessonForPlan(
  brand: string,
  progress: WellnessProgress,
  level: number,
  dayNum: number,
): WellnessSession | null {
  const published = readSessions(brand).filter(s => s.status === 'published')
  const completed = new Set(progress.completed_session_ids)
  let pool = published.filter(s => !completed.has(s.id) && (s.difficulty ?? 1) <= level)
  if (pool.length === 0) return null

  const focus = progress.focus_area
  // Weight toward focus_area matches first.
  if (focus) {
    const matches = pool.filter(s => s.focus_areas?.includes(focus))
    if (matches.length > 0) pool = matches
  }

  // Rotate categories day-to-day for variety, then prefer fewer-completed categories.
  const completedByCat = new Map<string, number>()
  for (const cat of CATEGORIES) {
    completedByCat.set(cat.key, progress.category_progress[cat.key]?.completed_session_ids.length ?? 0)
  }
  const rotateIdx = dayNum % Math.max(1, CATEGORIES.length)
  const preferredCat = CATEGORIES[rotateIdx]?.key

  pool.sort((a, b) => {
    const pa = a.category_key === preferredCat ? 0 : 1
    const pb = b.category_key === preferredCat ? 0 : 1
    if (pa !== pb) return pa - pb
    const ca = completedByCat.get(a.category_key) ?? 0
    const cb = completedByCat.get(b.category_key) ?? 0
    if (ca !== cb) return ca - cb
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
  return pool[0]
}

/** Scale an action's target value to the plan level (gentle bump, never below the
 *  authored value). Returns a copy of the item title with the scaled target hint. */
function actionItemTitle(action: ActionTask, level: number): string {
  if (!action.target) return action.title
  // Targets are authored per-difficulty already; if a lower-tier task is reused at a
  // higher level, nudge the displayed target up proportionally but keep it gentle.
  const scaled = Math.max(action.target.value, Math.round(action.target.value * (1 + 0.1 * (level - action.difficulty))))
  if (scaled === action.target.value) return action.title
  return action.title.replace(String(action.target.value), String(scaled))
}

/**
 * Get today's daily plan, building a fresh one if needed. A plan is 3 tasks spanning
 * distinct dimensions/kinds at the patient's level: 1 lesson + 2 actions (from two
 * different dimensions), or 3 actions if no lesson remains.
 */
export function getOrCreateDailyPlan(brand: string, token: string, todayISO: string): {
  plan: DailyPlan; progress: WellnessProgress; level: number
} {
  const all = readProgress(brand)
  let progress = all.find(p => p.token === token)
  if (!progress) { progress = emptyProgress(brand, token); all.push(progress) }
  normalizeProgress(progress)

  // Streak protection — consume a banked freeze to bridge a missed day before we
  // (re)build today's plan. Idempotent per day.
  applyStreakProtection(progress, todayISO)

  const level = levelFromHistory(progress.plan_history ?? [])
  progress.level = level

  // Same-day plan already exists → return it.
  if (progress.daily_plan && progress.daily_plan.date === todayISO) {
    progress.last_active_at = nowISO()
    writeProgress(brand, all)
    return { plan: progress.daily_plan, progress, level }
  }

  const dayNum = dayNumber(todayISO)
  const planLevel = (level as 1 | 2 | 3)
  const items: DailyPlanItem[] = []
  const usedDimensions = new Set<ActionDimension>()
  const usedActionIds = new Set<string>()

  // Task A — a lesson (if one remains at this level).
  const lesson = pickLessonForPlan(brand, progress, level, dayNum)
  if (lesson) {
    items.push({
      kind: 'lesson', ref_id: lesson.id, category_key: lesson.category_key,
      title: lesson.title, done: false,
    })
  }

  // Tasks B & C — two actions from two DIFFERENT dimensions, rotating day to day.
  const actionsNeeded = lesson ? 2 : 3
  // Build the day's dimension order, rotated so it stays fresh.
  const rotated: ActionDimension[] = []
  for (let i = 0; i < DIMENSION_ROTATION.length; i++) {
    rotated.push(DIMENSION_ROTATION[(dayNum + i) % DIMENSION_ROTATION.length])
  }
  for (const dim of rotated) {
    if (items.filter(it => it.kind === 'action').length >= actionsNeeded) break
    if (usedDimensions.has(dim)) continue
    const action = pickAction(dim, planLevel, progress.focus_area, usedActionIds, dayNum)
    if (!action) continue
    usedDimensions.add(dim)
    usedActionIds.add(action.id)
    items.push({
      kind: 'action', ref_id: action.id, dimension: action.dimension,
      title: actionItemTitle(action, level), done: false,
    })
  }

  const plan: DailyPlan = { date: todayISO, items, completed: false }
  progress.daily_plan = plan
  progress.last_active_at = nowISO()
  writeProgress(brand, all)
  return { plan, progress, level }
}

export interface PlanTodayView {
  plan: DailyPlan
  level: number
  streak: number
  focus_area: string | null
  all_done: boolean
  freezes: number
  streak_at_risk: boolean
  freeze_used_notice: boolean
}

/**
 * Build the patient-facing view for GET /plan/today. Runs the daily-plan builder
 * (which applies streak protection), then derives freeze + at-risk state and consumes
 * the one-time `freeze_used_notice` flag so the banner shows exactly once.
 */
export function getDailyPlanView(brand: string, token: string, todayISO: string): PlanTodayView {
  const { plan, progress, level } = getOrCreateDailyPlan(brand, token, todayISO)

  const allDone = plan.completed
  const streakAtRisk = !allDone && progress.streak_days > 0

  // Consume the transient freeze-used notice (set during applyStreakProtection).
  const freezeUsedNotice = progress.freeze_used_notice === true
  if (freezeUsedNotice) {
    const all = readProgress(brand)
    const stored = all.find(p => p.token === token)
    if (stored) {
      delete stored.freeze_used_notice
      writeProgress(brand, all)
    }
  }

  return {
    plan,
    level,
    streak: progress.streak_days,
    focus_area: progress.focus_area ?? null,
    all_done: allDone,
    freezes: progress.freezes ?? 0,
    streak_at_risk: streakAtRisk,
    freeze_used_notice: freezeUsedNotice,
  }
}

export interface CompleteTaskResult {
  plan: DailyPlan
  day_complete: boolean
  earned: number
  streak: number
  level: number
  leveled_up: boolean
}

const POINTS_PER_TASK = 30
const DAY_COMPLETE_BONUS = 60

export function completeDailyTask(
  brand: string,
  token: string,
  itemIndex: number,
  todayISO: string,
): CompleteTaskResult | null {
  const all = readProgress(brand)
  const progress = all.find(p => p.token === token)
  if (!progress) return null
  normalizeProgress(progress)

  // Ensure today's plan exists (rebuild if stale/missing).
  if (!progress.daily_plan || progress.daily_plan.date !== todayISO) {
    writeProgress(brand, all)
    const built = getOrCreateDailyPlan(brand, token, todayISO)
    progress.daily_plan = built.plan
  }
  const plan = progress.daily_plan
  if (!plan || itemIndex < 0 || itemIndex >= plan.items.length) return null

  const prevLevel = levelFromHistory(progress.plan_history ?? [])
  const item = plan.items[itemIndex]

  let earned = 0
  if (!item.done) {
    item.done = true
    earned += POINTS_PER_TASK
    progress.total_points += POINTS_PER_TASK
  }

  let dayComplete = false
  const allDone = plan.items.every(it => it.done)
  if (allDone && !plan.completed) {
    plan.completed = true
    plan.completed_at = nowISO()
    dayComplete = true
    earned += DAY_COMPLETE_BONUS
    progress.total_points += DAY_COMPLETE_BONUS

    // Streak: consecutive-day logic on plan_history.
    const history = progress.plan_history ?? (progress.plan_history = [])
    if (!history.includes(todayISO)) {
      const yesterday = isoYesterday(todayISO)
      if (history.includes(yesterday) || progress.last_completed_date === yesterday) {
        progress.streak_days += 1
      } else if (progress.last_completed_date === todayISO) {
        // already counted today — leave streak as is
      } else {
        progress.streak_days = 1
      }
      history.push(todayISO)
      progress.last_completed_date = todayISO
      progress.longest_streak = Math.max(progress.longest_streak, progress.streak_days)

      // Freeze earn rule: award 1 freeze each time the streak crosses a multiple of 7
      // (7, 14, 21…), capped at MAX_BANKED_FREEZES banked at once.
      if (progress.streak_days % 7 === 0 && (progress.freezes ?? 0) < MAX_BANKED_FREEZES) {
        progress.freezes = (progress.freezes ?? 0) + 1
        progress.freezes_earned_total = (progress.freezes_earned_total ?? 0) + 1
      }

      // Each completed lesson in the plan counts toward total_sessions/category progress.
      for (const it of plan.items) {
        if (it.kind === 'lesson' && !progress.completed_session_ids.includes(it.ref_id)) {
          progress.completed_session_ids.push(it.ref_id)
          progress.total_sessions += 1
          const catKey = it.category_key ?? 'inner-balance'
          const cat = progress.category_progress[catKey] ?? { completed_session_ids: [], level: 1, points: 0 }
          cat.completed_session_ids.push(it.ref_id)
          cat.level = Math.floor(cat.completed_session_ids.length / 3) + 1
          progress.category_progress[catKey] = cat
        }
      }
    }
  }

  const newLevel = levelFromHistory(progress.plan_history ?? [])
  progress.level = newLevel
  progress.last_active_at = nowISO()
  writeProgress(brand, all)

  return {
    plan,
    day_complete: dayComplete,
    earned,
    streak: progress.streak_days,
    level: newLevel,
    leveled_up: newLevel > prevLevel,
  }
}

export interface WellnessStats {
  total_sessions: number
  published_sessions: number
  draft_sessions: number
  sessions_by_category: Record<string, { total: number; published: number }>
  active_patients: number
  avg_streak: number
}

/** Read every progress record for a brand, normalized (default-safe fields filled). */
export function listAllProgress(brand: string): WellnessProgress[] {
  return readProgress(brand).map(normalizeProgress)
}

// ── Engagement analytics ───────────────────────────────────────────────────────

export interface EngagementStats {
  patients: { total_started: number; active_7d: number; active_today: number }
  engagement: {
    plans_completed: number
    avg_current_streak: number
    longest_streak_overall: number
    total_points: number
    total_lessons_completed: number
  }
  retention: {
    streak_buckets: { bucket: string; count: number }[]
    returning_rate: number
  }
  distribution: {
    by_focus_area: { key: string; label: string; emoji: string; count: number }[]
    by_level: { level: number; label: string; count: number }[]
  }
  content: { session_id: string; title: string; count: number }[]
  trend: { date: string; count: number }[]
}

const LEVEL_LABELS: Record<number, string> = { 1: 'Foundational', 2: 'Building', 3: 'Thriving' }

function emptyEngagementStats(): EngagementStats {
  return {
    patients: { total_started: 0, active_7d: 0, active_today: 0 },
    engagement: {
      plans_completed: 0,
      avg_current_streak: 0,
      longest_streak_overall: 0,
      total_points: 0,
      total_lessons_completed: 0,
    },
    retention: {
      streak_buckets: [
        { bucket: '0', count: 0 },
        { bucket: '1-2', count: 0 },
        { bucket: '3-6', count: 0 },
        { bucket: '7-13', count: 0 },
        { bucket: '14+', count: 0 },
      ],
      returning_rate: 0,
    },
    distribution: {
      by_focus_area: FOCUS_AREA_TRACKS.map(t => ({ key: t.key, label: t.label, emoji: t.emoji, count: 0 })),
      by_level: [1, 2, 3].map(l => ({ level: l, label: LEVEL_LABELS[l], count: 0 })),
    },
    content: [],
    trend: [],
  }
}

function streakBucket(streak: number): string {
  if (streak <= 0) return '0'
  if (streak <= 2) return '1-2'
  if (streak <= 6) return '3-6'
  if (streak <= 13) return '7-13'
  return '14+'
}

/**
 * Aggregate engagement analytics for the practitioner dashboard. Read-only over the
 * progress + sessions files. Defensive — never throws; returns zeros when empty.
 */
export function getEngagementStats(brand: string): EngagementStats {
  let progress: WellnessProgress[]
  let sessions: WellnessSession[]
  try {
    progress = listAllProgress(brand)
    sessions = readSessions(brand)
  } catch {
    return emptyEngagementStats()
  }

  if (progress.length === 0) return emptyEngagementStats()

  const titleById = new Map<string, string>()
  for (const s of sessions) titleById.set(s.id, s.title)

  const now = Date.now()
  const SEVEN_DAYS = 7 * 86_400_000
  const todayStr = new Date(now).toISOString().slice(0, 10)

  // Patients.
  const totalStarted = progress.length
  let active7d = 0
  let activeToday = 0

  // Engagement.
  let plansCompleted = 0
  let totalPoints = 0
  let totalLessons = 0
  let longestOverall = 0
  let streakSum = 0
  let streakCount = 0

  // Retention.
  const bucketCounts = new Map<string, number>([
    ['0', 0], ['1-2', 0], ['3-6', 0], ['7-13', 0], ['14+', 0],
  ])
  let returningCount = 0

  // Distribution.
  const focusCounts = new Map<string, number>()
  for (const t of FOCUS_AREA_TRACKS) focusCounts.set(t.key, 0)
  const levelCounts = new Map<number, number>([[1, 0], [2, 0], [3, 0]])

  // Content + trend accumulators.
  const lessonCounts = new Map<string, number>()
  const trendCounts = new Map<string, number>()

  for (const p of progress) {
    const lastActive = Date.parse(p.last_active_at)
    if (!Number.isNaN(lastActive)) {
      if (now - lastActive <= SEVEN_DAYS) active7d += 1
    }
    if (p.last_active_at?.slice(0, 10) === todayStr) activeToday += 1

    const history = p.plan_history ?? []
    plansCompleted += history.length
    totalPoints += p.total_points ?? 0
    totalLessons += p.completed_session_ids?.length ?? 0
    longestOverall = Math.max(longestOverall, p.longest_streak ?? 0)
    if ((p.streak_days ?? 0) > 0) { streakSum += p.streak_days; streakCount += 1 }

    bucketCounts.set(streakBucket(p.streak_days ?? 0), (bucketCounts.get(streakBucket(p.streak_days ?? 0)) ?? 0) + 1)
    if (history.length >= 2) returningCount += 1

    const focus = p.focus_area && focusCounts.has(p.focus_area) ? p.focus_area : 'general'
    focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1)

    const lvl = Math.min(3, Math.max(1, p.level ?? 1))
    levelCounts.set(lvl, (levelCounts.get(lvl) ?? 0) + 1)

    for (const sid of p.completed_session_ids ?? []) {
      lessonCounts.set(sid, (lessonCounts.get(sid) ?? 0) + 1)
    }
    for (const d of history) {
      trendCounts.set(d, (trendCounts.get(d) ?? 0) + 1)
    }
  }

  // Top 8 completed lessons.
  const content = [...lessonCounts.entries()]
    .map(([session_id, count]) => ({ session_id, title: titleById.get(session_id) ?? 'Unknown lesson', count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, 8)

  // 14-day trend (oldest → newest), zero-filled.
  const trend: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10)
    trend.push({ date: d, count: trendCounts.get(d) ?? 0 })
  }

  return {
    patients: { total_started: totalStarted, active_7d: active7d, active_today: activeToday },
    engagement: {
      plans_completed: plansCompleted,
      avg_current_streak: streakCount > 0 ? Math.round((streakSum / streakCount) * 10) / 10 : 0,
      longest_streak_overall: longestOverall,
      total_points: totalPoints,
      total_lessons_completed: totalLessons,
    },
    retention: {
      streak_buckets: ['0', '1-2', '3-6', '7-13', '14+'].map(bucket => ({ bucket, count: bucketCounts.get(bucket) ?? 0 })),
      returning_rate: totalStarted > 0 ? Math.round((returningCount / totalStarted) * 1000) / 10 : 0,
    },
    distribution: {
      by_focus_area: FOCUS_AREA_TRACKS.map(t => ({ key: t.key, label: t.label, emoji: t.emoji, count: focusCounts.get(t.key) ?? 0 })),
      by_level: [1, 2, 3].map(l => ({ level: l, label: LEVEL_LABELS[l], count: levelCounts.get(l) ?? 0 })),
    },
    content,
    trend,
  }
}

export function getWellnessStats(brand: string): WellnessStats {
  const sessions = readSessions(brand)
  const progress = readProgress(brand)
  const byCat: Record<string, { total: number; published: number }> = {}
  for (const cat of CATEGORIES) byCat[cat.key] = { total: 0, published: 0 }
  let published = 0
  for (const s of sessions) {
    const entry = byCat[s.category_key] ?? (byCat[s.category_key] = { total: 0, published: 0 })
    entry.total += 1
    if (s.status === 'published') { entry.published += 1; published += 1 }
  }
  const activePatients = progress.filter(p => p.total_sessions > 0).length
  const avgStreak = progress.length > 0
    ? progress.reduce((sum, p) => sum + p.streak_days, 0) / progress.length
    : 0
  return {
    total_sessions: sessions.length,
    published_sessions: published,
    draft_sessions: sessions.length - published,
    sessions_by_category: byCat,
    active_patients: activePatients,
    avg_streak: Math.round(avgStreak * 10) / 10,
  }
}
