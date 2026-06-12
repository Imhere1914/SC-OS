import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

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
  writeFileSync(p + '.tmp', JSON.stringify(data, null, 2))
  renameSync(p + '.tmp', p)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = 'nps' | 'rating' | 'text' | 'single_choice' | 'multiple_choice'

export interface SurveyQuestion {
  id: string
  type: QuestionType
  text: string
  required: boolean
  options?: string[]      // for single/multiple choice
  min_label?: string      // for nps/rating: label for low end
  max_label?: string      // for nps/rating: label for high end
  scale?: number          // for rating: 1-5 or 1-10, default 5
}

export interface SurveyRecord {
  id: string
  brand: string
  title: string
  description?: string
  questions: SurveyQuestion[]
  status: 'draft' | 'active' | 'closed'
  response_count: number
  created_at: string
  updated_at: string
}

export interface SurveyResponse {
  id: string
  survey_id: string
  brand: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  answers: Record<string, string | number | string[]>  // questionId → answer
  nps_score?: number    // if survey has an NPS question, extracted for easy reporting
  submitted_at: string
  ip?: string
}

export interface SurveyStats {
  response_count: number
  nps_score?: number
  nps_breakdown?: { promoters: number; passives: number; detractors: number }
  avg_ratings: Record<string, number>
}

// ── File helpers ──────────────────────────────────────────────────────────────

function surveysFile(brand: string) {
  return `surveys-${brand}.json`
}

function responsesFile(surveyId: string) {
  return `survey-responses-${surveyId}.json`
}

// ── Survey CRUD ───────────────────────────────────────────────────────────────

export function listSurveys(brand: string): SurveyRecord[] {
  return readJson<SurveyRecord[]>(surveysFile(brand), [])
}

export function getSurvey(id: string, brand?: string): SurveyRecord | null {
  if (brand) {
    const surveys = listSurveys(brand)
    return surveys.find(s => s.id === id) ?? null
  }
  // Search across known brand files
  const brands = ['sc', 'hfm', 'default']
  for (const b of brands) {
    const found = listSurveys(b).find(s => s.id === id)
    if (found) return found
  }
  return null
}

export function createSurvey(
  brand: string,
  data: Omit<SurveyRecord, 'id' | 'brand' | 'response_count' | 'created_at' | 'updated_at'>,
): SurveyRecord {
  const surveys = listSurveys(brand)
  const now = new Date().toISOString()
  const survey: SurveyRecord = {
    ...data,
    id: nanoid(),
    brand,
    response_count: 0,
    created_at: now,
    updated_at: now,
  }
  writeJson(surveysFile(brand), [survey, ...surveys])
  return survey
}

export function updateSurvey(
  brand: string,
  id: string,
  patch: Partial<Omit<SurveyRecord, 'id' | 'brand' | 'created_at'>>,
): SurveyRecord | null {
  const surveys = listSurveys(brand)
  const idx = surveys.findIndex(s => s.id === id)
  if (idx === -1) return null
  const updated: SurveyRecord = { ...surveys[idx], ...patch, updated_at: new Date().toISOString() }
  surveys[idx] = updated
  writeJson(surveysFile(brand), surveys)
  return updated
}

export function deleteSurvey(brand: string, id: string): boolean {
  const surveys = listSurveys(brand)
  const next = surveys.filter(s => s.id !== id)
  if (next.length === surveys.length) return false
  writeJson(surveysFile(brand), next)
  return true
}

// ── Responses ─────────────────────────────────────────────────────────────────

export function addResponse(
  surveyId: string,
  brand: string,
  data: Omit<SurveyResponse, 'id' | 'submitted_at'>,
): SurveyResponse {
  const responses = listResponses(surveyId)
  const response: SurveyResponse = {
    ...data,
    id: nanoid(),
    submitted_at: new Date().toISOString(),
  }
  writeJson(responsesFile(surveyId), [response, ...responses])

  // Increment response_count on the survey
  const survey = getSurvey(surveyId, brand)
  if (survey) {
    updateSurvey(brand, surveyId, { response_count: (survey.response_count ?? 0) + 1 })
  }

  return response
}

export function listResponses(surveyId: string): SurveyResponse[] {
  return readJson<SurveyResponse[]>(responsesFile(surveyId), [])
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getSurveyStats(surveyId: string): SurveyStats {
  const responses = listResponses(surveyId)
  const total = responses.length

  // NPS calculation
  const npsScores = responses.map(r => r.nps_score).filter((s): s is number => typeof s === 'number')
  let nps_score: number | undefined
  let nps_breakdown: SurveyStats['nps_breakdown']

  if (npsScores.length > 0) {
    const promoters = npsScores.filter(s => s >= 9).length
    const passives = npsScores.filter(s => s >= 7 && s <= 8).length
    const detractors = npsScores.filter(s => s <= 6).length
    nps_score = Math.round(((promoters - detractors) / npsScores.length) * 100)
    nps_breakdown = { promoters, passives, detractors }
  }

  // Average ratings per question
  const avg_ratings: Record<string, number> = {}
  if (total > 0) {
    // Collect all question IDs that have numeric answers
    const questionIds = new Set<string>()
    for (const r of responses) {
      for (const [qId, ans] of Object.entries(r.answers)) {
        if (typeof ans === 'number') questionIds.add(qId)
      }
    }
    for (const qId of questionIds) {
      const vals = responses
        .map(r => r.answers[qId])
        .filter((v): v is number => typeof v === 'number')
      if (vals.length > 0) {
        avg_ratings[qId] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      }
    }
  }

  return {
    response_count: total,
    nps_score,
    nps_breakdown,
    avg_ratings,
  }
}
