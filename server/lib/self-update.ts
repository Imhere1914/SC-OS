import { spawn, spawnSync } from 'child_process'
import { existsSync, openSync, closeSync, statSync, readSync, appendFileSync } from 'fs'
import {
  createSelfDeploy,
  getSelfDeploy,
  updateSelfDeploy,
  type SelfDeployRecord,
} from '../stores/self-deploy-store'

/**
 * Safe self-update pipeline — lets Dev Studio agents work on a STAGING copy of
 * the OS (/opt/ai-os-staging) and promotes it to live (/opt/ai-os) through a
 * gated deploy script (server/scripts/self-deploy.sh): staging build gate →
 * backup → sync → live rebuild → restart → health check → auto-rollback.
 *
 * Chicken-and-egg note: the deploy script restarts the very service that
 * spawned it. The script is therefore spawned DETACHED with its stdio bound
 * directly to the log file fd, so it survives the systemd restart of its
 * parent. The deploy record is finalized lazily by reconcileDeploy(), which
 * reads the log tail on the next status request (after the restarted server
 * comes back up).
 */

const STAGING_DIR = '/opt/ai-os-staging'
const LIVE_DIR = '/opt/ai-os'
const DEPLOY_SCRIPT = `${LIVE_DIR}/server/scripts/self-deploy.sh`
const RECONCILE_TIMEOUT_MS = 10 * 60 * 1000 // running >10min with no verdict → failed

export interface SelfUpdateResult {
  ok: boolean
  note: string
}

/** True only on the server, where the live install actually exists. */
export function isServerEnvironment(): boolean {
  return existsSync(LIVE_DIR)
}

export function stagingExists(): boolean {
  return existsSync(STAGING_DIR)
}

const NOT_SERVER: SelfUpdateResult = { ok: false, note: 'self-update only available on the server' }

/** Run a shell command synchronously, capturing combined output. Never throws. */
function run(cmd: string, args: string[], cwd?: string): { ok: boolean; output: string } {
  try {
    const res = spawnSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    })
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    if (res.error) return { ok: false, output: `${res.error.message}\n${output}`.trim() }
    return { ok: res.status === 0, output }
  } catch (err) {
    return { ok: false, output: (err as Error).message }
  }
}

/** rsync live → staging, preserving staging's env files / node_modules / dist. */
function syncLiveToStaging(): { ok: boolean; output: string } {
  return run('rsync', [
    '-a', '--delete',
    '--exclude', 'node_modules',
    '--exclude', 'dist',
    '--exclude', '.env.*',
    `${LIVE_DIR}/`, `${STAGING_DIR}/`,
  ])
}

/**
 * Ensure the staging workspace exists. If missing, create it from live and
 * npm-install it. If present, leave it alone (it may hold un-deployed agent
 * work) — use refreshStaging() to explicitly reset it from live.
 */
export async function ensureStaging(): Promise<SelfUpdateResult> {
  if (!isServerEnvironment()) return NOT_SERVER
  if (stagingExists()) {
    return { ok: true, note: 'staging already exists — left untouched (use reset to refresh from live)' }
  }
  const sync = syncLiveToStaging()
  if (!sync.ok) return { ok: false, note: `failed to create staging: ${sync.output.slice(-500)}` }
  const install = run('npm', ['install', '--silent', '--include=dev'], STAGING_DIR)
  if (!install.ok) return { ok: false, note: `staging created but npm install failed: ${install.output.slice(-500)}` }
  return { ok: true, note: 'staging created from live and dependencies installed' }
}

/**
 * Reset staging from live — OVERWRITES any un-deployed agent work in staging.
 * The UI gates this behind its own confirm.
 */
export async function refreshStaging(): Promise<SelfUpdateResult> {
  if (!isServerEnvironment()) return NOT_SERVER
  const sync = syncLiveToStaging()
  if (!sync.ok) return { ok: false, note: `failed to refresh staging: ${sync.output.slice(-500)}` }
  const install = run('npm', ['install', '--silent', '--include=dev'], STAGING_DIR)
  if (!install.ok) return { ok: false, note: `staging refreshed but npm install failed: ${install.output.slice(-500)}` }
  return { ok: true, note: 'staging reset from live' }
}

// ── Deploy ────────────────────────────────────────────────────────────────────

/**
 * Kick off the gated deploy pipeline. The script restarts this very process,
 * so it is spawned detached with stdio bound to the log file fd — it keeps
 * running and logging through the restart. The returned record stays
 * 'running' until reconcileDeploy() reads the verdict from the log tail.
 */
export function runSelfDeploy(brand: string): { id: string } | SelfUpdateResult {
  if (!isServerEnvironment()) return NOT_SERVER
  if (!existsSync(DEPLOY_SCRIPT)) {
    return { ok: false, note: `deploy script missing at ${DEPLOY_SCRIPT}` }
  }
  if (!stagingExists()) {
    return { ok: false, note: 'staging does not exist — create it first' }
  }
  const record = createSelfDeploy(brand)
  let fd: number
  try {
    fd = openSync(record.log_file, 'a')
  } catch (err) {
    updateSelfDeploy(record.id, { status: 'failed', finished_at: new Date().toISOString() })
    return { ok: false, note: `could not open deploy log: ${(err as Error).message}` }
  }
  try {
    // The pipeline restarts the service that spawned it. A plain detached child
    // still lives in the service's cgroup and gets killed by the restart, so we
    // launch it as a transient systemd unit (own cgroup) when systemd-run exists;
    // shell redirection keeps the log flowing to the same file for the reconciler.
    const hasSystemdRun = spawnSync('which', ['systemd-run']).status === 0
    const child = hasSystemdRun
      ? spawn('systemd-run', [
          '--unit', `ai-os-selfdeploy-${record.id.slice(0, 8)}`,
          '--collect',
          'bash', '-c', `bash ${DEPLOY_SCRIPT} >> ${record.log_file} 2>&1`,
        ], { detached: true, stdio: ['ignore', fd, fd], env: { ...process.env } })
      : spawn('bash', [DEPLOY_SCRIPT], {
          detached: true,
          stdio: ['ignore', fd, fd],
          env: { ...process.env },
        })
    child.unref()
    if (typeof child.pid !== 'number') {
      throw new Error('spawn returned no pid')
    }
  } catch (err) {
    try {
      appendFileSync(record.log_file, `[self-update] failed to spawn deploy script: ${(err as Error).message}\n`)
    } catch {
      // log not writable — nothing else to do
    }
    updateSelfDeploy(record.id, { status: 'failed', finished_at: new Date().toISOString() })
    closeSync(fd)
    return { ok: false, note: `failed to spawn deploy script: ${(err as Error).message}` }
  }
  // The parent's copy of the fd can be closed — the child holds its own.
  closeSync(fd)
  return { id: record.id }
}

/**
 * Reconcile a deploy record that may have been orphaned by the service restart
 * the pipeline itself performs. Reads the log tail for the script's final
 * verdict and finalizes the record. Safe to call on every status request.
 */
export function reconcileDeploy(id: string): SelfDeployRecord | null {
  const record = getSelfDeploy(id)
  if (!record || record.status !== 'running') return record
  let tail = ''
  try {
    if (existsSync(record.log_file)) {
      const size = statSync(record.log_file).size
      const length = Math.min(size, 8192)
      const buf = Buffer.alloc(length)
      const fd = openSync(record.log_file, 'r')
      try {
        readSync(fd, buf, 0, length, size - length)
      } finally {
        closeSync(fd)
      }
      tail = buf.toString('utf-8')
    }
  } catch {
    // unreadable log — fall through to timeout check
  }
  const finalize = (status: SelfDeployRecord['status'], exitCode?: number) =>
    updateSelfDeploy(id, { status, exit_code: exitCode, finished_at: new Date().toISOString() })
  if (/\bDEPLOYED\b/.test(tail)) return finalize('deployed', 0)
  if (/ROLLED BACK/.test(tail)) return finalize('rolled_back')
  if (/FAILED/.test(tail)) return finalize('failed')
  if (Date.now() - new Date(record.started_at).getTime() > RECONCILE_TIMEOUT_MS) {
    return finalize('failed')
  }
  return record
}

/** Read incremental deploy log content (same offset contract as dev task logs). */
export function readDeployLog(id: string, offset = 0): { content: string; size: number } {
  const record = getSelfDeploy(id)
  if (!record || !existsSync(record.log_file)) return { content: '', size: 0 }
  const size = statSync(record.log_file).size
  const safeOffset = Math.max(0, Math.min(offset, size))
  if (safeOffset >= size) return { content: '', size }
  const length = size - safeOffset
  const buf = Buffer.alloc(length)
  const fd = openSync(record.log_file, 'r')
  try {
    readSync(fd, buf, 0, length, safeOffset)
  } finally {
    closeSync(fd)
  }
  return { content: buf.toString('utf-8'), size }
}

/** Staging presence + path — for the status endpoint. */
export function getStagingInfo(): { exists: boolean; path: string } {
  return { exists: stagingExists(), path: STAGING_DIR }
}
