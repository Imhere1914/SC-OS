import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { createDevTask, getDevTask } from '../stores/dev-tasks-store'
import { runDevTask } from './dev-agents'

/**
 * Site Studio — a site-scoped wrapper around the Dev Studio agent runner that
 * lets the owner describe website changes in natural language. Claude Code
 * edits the actual marketing-site repo, builds it, and (on approval) the dist/
 * is rsynced live and served by nginx.
 *
 * This REUSES the dev-tasks store + dev-agents runner: startSiteEdit() creates
 * a normal dev-task forced to agent='claude' with the site repo as workspace,
 * so the existing /api/dev/tasks/:id + /log polling UI works unchanged.
 *
 * The repo / deploy paths only exist on the VPS — on Mac/dev they're absent, so
 * every server-touching call guards like self-update.ts (returns server:false /
 * an ok:false note) instead of throwing.
 */

export type SiteKey = 'sc' | 'hfm'

export interface SiteDef {
  key: SiteKey
  name: string
  url: string
  repo: string // git-tracked Vite/React source on the VPS
  deployTo: string // nginx docroot (dist/ rsynced here)
}

export const SITES: Record<SiteKey, SiteDef> = {
  sc: {
    key: 'sc',
    name: 'Simple Connect',
    url: 'https://www.simpleconnect2.com',
    repo: '/opt/sites/sc-website',
    deployTo: '/var/www/sc-website',
  },
  hfm: {
    key: 'hfm',
    name: 'Holistic Functional Care',
    url: 'https://www.holisticfunctionalcare.com',
    repo: '/opt/sites/hfm-website',
    deployTo: '/var/www/hfm-website',
  },
}

const COMMIT_PREFIX = 'Site Studio:'

export function isSiteKey(v: unknown): v is SiteKey {
  return v === 'sc' || v === 'hfm'
}

export function getSite(key: SiteKey): SiteDef {
  return SITES[key]
}

/** True only on the server, where the staged site repos actually exist. */
export function isServerEnvironment(): boolean {
  return existsSync(SITES.sc.repo) || existsSync(SITES.hfm.repo)
}

function siteReady(site: SiteDef): boolean {
  return existsSync(site.repo)
}

export interface SiteResult {
  ok: boolean
  log: string
}

/** Run a shell command synchronously, capturing combined output. Never throws. */
function run(cmd: string, args: string[], cwd: string): SiteResult {
  try {
    const res = spawnSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    })
    const log = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    if (res.error) return { ok: false, log: `${res.error.message}\n${log}`.trim() }
    return { ok: res.status === 0, log }
  } catch (err) {
    return { ok: false, log: (err as Error).message }
  }
}

// ── Recent edits (git log) ─────────────────────────────────────────────────────

export interface SiteCommit {
  hash: string
  subject: string
}

/** Last 20 commits (oneline) in the site repo. Empty on dev / non-server. */
export function listSiteEdits(key: SiteKey): SiteCommit[] {
  const site = SITES[key]
  if (!siteReady(site)) return []
  const res = run('git', ['log', '-n', '20', '--pretty=format:%h%x09%s'], site.repo)
  if (!res.ok || !res.log) return []
  return res.log
    .split('\n')
    .map((line) => {
      const tab = line.indexOf('\t')
      if (tab === -1) return null
      return { hash: line.slice(0, tab), subject: line.slice(tab + 1) }
    })
    .filter((c): c is SiteCommit => c !== null)
}

// ── Start an edit (reuse the dev-agents runner) ────────────────────────────────

function buildPreamble(site: SiteDef, prompt: string): string {
  return [
    `You are editing the ${site.name} marketing website (Vite + React + shadcn + Tailwind).`,
    'Make ONLY the change described. Do not run the dev server.',
    'After editing, run `npm run build` to confirm it compiles.',
    'Keep the existing design system and components.',
    `Change requested: ${prompt}`,
  ].join(' ')
}

export interface StartEditResult {
  ok: boolean
  taskId?: string
  error?: string
}

/**
 * Create + spawn a dev-task scoped to the site repo. Forces agent='claude' and
 * workspace=the site repo, prepending a site-aware preamble. Returns the
 * dev-task id so the existing log-polling UI can follow progress.
 */
export function startSiteEdit(key: SiteKey, prompt: string): StartEditResult {
  const site = SITES[key]
  if (!siteReady(site)) {
    return { ok: false, error: 'Site Studio is only available on the server' }
  }
  const trimmed = prompt.trim()
  if (!trimmed) return { ok: false, error: 'prompt is required' }

  // brand the dev-tasks store namespace per-site so each site has its own list
  const brand = `site-${key}`
  const task = createDevTask(brand, {
    agent: 'claude',
    prompt: buildPreamble(site, trimmed),
    workspace: site.repo,
  })
  runDevTask(brand, task.id) // fire and forget — UI polls for progress
  return { ok: true, taskId: task.id }
}

/** Resolve the dev-task brand namespace for a site (for log/status lookups). */
export function siteTaskBrand(key: SiteKey): string {
  return `site-${key}`
}

// ── Build preview ──────────────────────────────────────────────────────────────

/** `npm run build` in the repo. On success dist/ is the preview. */
export function buildSitePreview(key: SiteKey): SiteResult {
  const site = SITES[key]
  if (!siteReady(site)) return { ok: false, log: 'Site Studio is only available on the server' }
  return run('npm', ['run', 'build'], site.repo)
}

function distExists(site: SiteDef): boolean {
  return existsSync(`${site.repo}/dist`)
}

// ── Deploy ─────────────────────────────────────────────────────────────────────

export interface DeployResult {
  ok: boolean
  log: string
  commitHash?: string
}

/**
 * Commit pending edits and publish: git add -A && git commit, build (if dist
 * stale/missing), then rsync repo/dist/ → deployTo (nginx docroot).
 */
export function deploySite(key: SiteKey, summary?: string): DeployResult {
  const site = SITES[key]
  if (!siteReady(site)) return { ok: false, log: 'Site Studio is only available on the server' }

  const log: string[] = []
  const short = (summary ?? 'publish pending edits').trim().slice(0, 60)

  // commit any working-tree changes (no-op if clean)
  const add = run('git', ['add', '-A'], site.repo)
  log.push(`$ git add -A\n${add.log}`)
  const status = run('git', ['status', '--porcelain'], site.repo)
  if (status.ok && status.log.trim()) {
    const commit = run('git', ['commit', '-m', `${COMMIT_PREFIX} ${short}`], site.repo)
    log.push(`$ git commit\n${commit.log}`)
    if (!commit.ok) return { ok: false, log: log.join('\n\n') }
  } else {
    log.push('(no working-tree changes to commit)')
  }

  // build if dist is missing
  if (!distExists(site)) {
    const build = run('npm', ['run', 'build'], site.repo)
    log.push(`$ npm run build\n${build.log}`)
    if (!build.ok) return { ok: false, log: log.join('\n\n') }
  }

  // rsync dist/ → nginx docroot
  const rsync = run('rsync', ['-a', '--delete', `${site.repo}/dist/`, `${site.deployTo}/`], site.repo)
  log.push(`$ rsync dist/ → ${site.deployTo}\n${rsync.log}`)
  if (!rsync.ok) return { ok: false, log: log.join('\n\n') }

  const hash = run('git', ['rev-parse', '--short', 'HEAD'], site.repo)
  return {
    ok: true,
    log: log.join('\n\n'),
    commitHash: hash.ok ? hash.log.trim() : undefined,
  }
}

// ── Revert ─────────────────────────────────────────────────────────────────────

/**
 * Revert the last Site-Studio commit: git reset --hard HEAD~1, then rebuild +
 * redeploy. Safety: only proceeds if HEAD is a Site-Studio commit.
 */
export function revertLastSiteEdit(key: SiteKey): SiteResult {
  const site = SITES[key]
  if (!siteReady(site)) return { ok: false, log: 'Site Studio is only available on the server' }

  const head = run('git', ['log', '-1', '--pretty=format:%s'], site.repo)
  if (!head.ok) return head
  if (!head.log.trim().startsWith(COMMIT_PREFIX)) {
    return { ok: false, log: `HEAD is not a Site Studio commit ("${head.log.trim()}") — refusing to revert.` }
  }

  const log: string[] = []
  const reset = run('git', ['reset', '--hard', 'HEAD~1'], site.repo)
  log.push(`$ git reset --hard HEAD~1\n${reset.log}`)
  if (!reset.ok) return { ok: false, log: log.join('\n\n') }

  const build = run('npm', ['run', 'build'], site.repo)
  log.push(`$ npm run build\n${build.log}`)
  if (!build.ok) return { ok: false, log: log.join('\n\n') }

  const rsync = run('rsync', ['-a', '--delete', `${site.repo}/dist/`, `${site.deployTo}/`], site.repo)
  log.push(`$ rsync dist/ → ${site.deployTo}\n${rsync.log}`)
  return { ok: rsync.ok, log: log.join('\n\n') }
}

// ── Status ─────────────────────────────────────────────────────────────────────

export interface SiteStatus {
  key: SiteKey
  name: string
  url: string
  lastCommits: SiteCommit[]
}

export function siteStatus(key: SiteKey): SiteStatus {
  const site = SITES[key]
  return { key, name: site.name, url: site.url, lastCommits: listSiteEdits(key) }
}

/** Re-export for the route to find the dev-task + log given a site + task id. */
export { getDevTask }
