import { spawn } from 'child_process'
import { createWriteStream, mkdirSync, existsSync, openSync, readSync, closeSync, statSync, appendFileSync } from 'fs'
import { join, sep } from 'path'
import {
  getDevTask,
  updateDevTask,
  type DevAgent,
} from '../stores/dev-tasks-store'

/**
 * Dev Studio process runner — spawns Claude Code / Codex CLIs headlessly,
 * pipes their output to per-task log files, and tracks lifecycle in the
 * dev-tasks store.
 */

const TASK_TIMEOUT_MS = 30 * 60 * 1000 // hard kill after 30 minutes

/** Tools Claude Code is allowed to use without prompting in headless mode. */
const CLAUDE_ALLOWED_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch'

/**
 * Build the CLI invocation for an agent.
 * - claude: verified flag set per `claude --help` (-p/--print, --output-format,
 *   --permission-mode, --allowedTools). Auth via ANTHROPIC_API_KEY in env.
 * - codex: verified locally against codex-cli 0.130.0 — `codex exec --sandbox
 *   workspace-write` runs non-interactive with the workspace-write sandbox
 *   (the documented `--full-auto` is deprecated in 0.130.0 in favour of this).
 *   --skip-git-repo-check lets it run in fresh (non-git) workspaces;
 *   --color never keeps logs clean. Auth via OPENAI_API_KEY in env.
 */
export function buildAgentCommand(agent: DevAgent, prompt: string): { cmd: string; args: string[] } {
  if (agent === 'claude') {
    return {
      cmd: 'claude',
      args: [
        '-p', prompt,
        '--output-format', 'text',
        '--permission-mode', 'acceptEdits',
        '--allowedTools', CLAUDE_ALLOWED_TOOLS,
      ],
    }
  }
  return {
    cmd: 'codex',
    args: ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--color', 'never', prompt],
  }
}

// ── Workspace safety ──────────────────────────────────────────────────────────

const FORBIDDEN_ROOTS = ['/', '/etc', '/usr', '/var']

/**
 * Resolve (and validate) the workspace dir for a task.
 * Default: ~/agents-workspace/{taskId}. Custom paths must be absolute and must
 * not be / , /etc, /usr, /var or live inside them. /opt/ai-os-staging is the
 * preferred target for self-update work (safe — promoted to live via the gated
 * /api/self-update pipeline). /opt/ai-os stays allowed for direct edits, but
 * the UI shows a warning since it modifies the running OS.
 */
export function resolveWorkspace(input: string | undefined, taskId: string): string {
  const trimmed = input?.trim()
  if (!trimmed) {
    return join(process.env.HOME ?? '/root', 'agents-workspace', taskId)
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Workspace path must be absolute')
  }
  // normalize trailing slash (but keep '/')
  const path = trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed
  for (const root of FORBIDDEN_ROOTS) {
    if (path === root || (root !== '/' && path.startsWith(root + sep))) {
      throw new Error(`Workspace path ${path} is not allowed (inside ${root})`)
    }
    if (root === '/' && path === '/') {
      throw new Error('Workspace path / is not allowed')
    }
  }
  return path
}

// ── Runner ────────────────────────────────────────────────────────────────────

const runningTasks = new Map<string, { pid: number; timer: NodeJS.Timeout }>()

export function runDevTask(brand: string, taskId: string): void {
  const task = getDevTask(brand, taskId)
  if (!task) return

  const fail = (message: string) => {
    try {
      appendFileSync(task.log_file, `[err] ${message}\n`, 'utf-8')
    } catch {
      // log dir missing — nothing else to do
    }
    updateDevTask(brand, taskId, {
      status: 'failed',
      finished_at: new Date().toISOString(),
    })
  }

  try {
    if (!existsSync(task.workspace)) mkdirSync(task.workspace, { recursive: true })
  } catch (err) {
    fail(`Failed to create workspace ${task.workspace}: ${(err as Error).message}`)
    return
  }

  const { cmd, args } = buildAgentCommand(task.agent, task.prompt)
  const logStream = createWriteStream(task.log_file, { flags: 'a' })
  logStream.on('error', (err) => {
    console.error(`[dev-agents] log stream error for ${taskId}:`, err.message)
  })
  logStream.write(`$ ${cmd} ${args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}\n\n`)

  let child
  try {
    child = spawn(cmd, args, {
      cwd: task.workspace,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    logStream.end()
    fail(`Failed to spawn ${cmd}: ${(err as Error).message}`)
    return
  }

  const startedAt = Date.now()
  updateDevTask(brand, taskId, {
    status: 'running',
    pid: child.pid,
    started_at: new Date(startedAt).toISOString(),
  })

  child.stdout.on('data', (chunk: Buffer) => {
    logStream.write(chunk)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    // prefix each stderr line so the UI can distinguish it
    const text = chunk.toString('utf-8')
    const prefixed = text.replace(/^/gm, '[err] ').replace(/\[err\] $/, '')
    logStream.write(prefixed)
  })

  const timer = setTimeout(() => {
    logStream.write(`\n[err] Task exceeded ${TASK_TIMEOUT_MS / 60000} minute limit — killing process\n`)
    try {
      child.kill('SIGKILL')
    } catch {
      // already dead
    }
  }, TASK_TIMEOUT_MS)

  if (child.pid) runningTasks.set(taskId, { pid: child.pid, timer })

  // spawn failures (e.g. CLI not installed) emit 'error' and MAY also emit
  // 'close' — guard so we only finalize the log/task once.
  let finished = false

  child.on('error', (err) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    runningTasks.delete(taskId)
    logStream.write(`[err] ${err.message}${(err as NodeJS.ErrnoException).code === 'ENOENT' ? ` — is the ${cmd} CLI installed and on PATH?` : ''}\n`)
    logStream.end()
    updateDevTask(brand, taskId, {
      status: 'failed',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    })
  })

  child.on('close', (exitCode) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    runningTasks.delete(taskId)
    logStream.write(`\n— process exited with code ${exitCode ?? 'null'} —\n`)
    logStream.end()
    const current = getDevTask(brand, taskId)
    // cancelDevTask already marked it — keep 'cancelled' status
    if (current?.status === 'cancelled') {
      updateDevTask(brand, taskId, {
        exit_code: exitCode ?? undefined,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      })
      return
    }
    updateDevTask(brand, taskId, {
      status: exitCode === 0 ? 'completed' : 'failed',
      exit_code: exitCode ?? undefined,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    })
  })
}

export function cancelDevTask(brand: string, taskId: string): boolean {
  const task = getDevTask(brand, taskId)
  if (!task) return false
  if (task.status !== 'running' && task.status !== 'queued') return false
  updateDevTask(brand, taskId, { status: 'cancelled' })
  const running = runningTasks.get(taskId)
  const pid = running?.pid ?? task.pid
  if (pid) {
    try {
      process.kill(pid)
    } catch {
      // process already gone
    }
  }
  if (running) {
    clearTimeout(running.timer)
    runningTasks.delete(taskId)
  }
  return true
}

// ── Log reading ───────────────────────────────────────────────────────────────

export function readTaskLog(taskId: string, offset = 0): { content: string; size: number } {
  const logFile = join(
    process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os'),
    'dev-logs',
    `${taskId}.log`
  )
  if (!existsSync(logFile)) return { content: '', size: 0 }
  const size = statSync(logFile).size
  const safeOffset = Math.max(0, Math.min(offset, size))
  if (safeOffset >= size) return { content: '', size }
  const length = size - safeOffset
  const buf = Buffer.alloc(length)
  const fd = openSync(logFile, 'r')
  try {
    readSync(fd, buf, 0, length, safeOffset)
  } finally {
    closeSync(fd)
  }
  return { content: buf.toString('utf-8'), size }
}
