import { useState, useEffect, useRef, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  ArrowUp01Icon,
  Delete01Icon,
  SparklesIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'

interface FloatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'hermes-chat-history'
const MAX_HISTORY = 50
const MAX_CONTEXT = 8

function loadHistory(): FloatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as FloatMessage[]).slice(-MAX_HISTORY)
  } catch {
    return []
  }
}

function saveHistory(msgs: FloatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)))
  } catch {
    /* noop */
  }
}

function LoadingDots({ accentColor }: { accentColor: string }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full animate-bounce"
          style={{
            background: accentColor,
            animationDelay: `${d * 0.15}s`,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}

export function HermesFloat() {
  const brand = useBrand()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<FloatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyLoaded = useRef(false)

  // Load history once on mount (client-side only)
  useEffect(() => {
    if (!historyLoaded.current) {
      historyLoaded.current = true
      setMessages(loadHistory())
    }
  }, [])

  // Save history whenever messages change
  useEffect(() => {
    if (historyLoaded.current) {
      saveHistory(messages)
    }
  }, [messages])

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [messages, busy, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || busy) return

    const next: FloatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)

    try {
      const context = next.slice(-MAX_CONTEXT)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: context }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Chat failed')
      }
      const data = await res.json() as { reply: string }
      setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages([
        ...next,
        { role: 'assistant', content: `Sorry, something went wrong. ${(e as Error).message}` },
      ])
    } finally {
      setBusy(false)
    }
  }, [input, busy, messages])

  const handleClear = useCallback(() => {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
  }, [])

  const orbGradient = `linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))`
  const orbShadow = `0 4px 20px color-mix(in srgb, ${brand.accentColor} 45%, transparent)`

  return (
    <>
      {/* ── Floating orb button ── */}
      {/* Note: hermes-orb is on the inner span, not the button, to avoid the
          `.hermes-orb { position: relative }` rule in styles.css overriding
          Tailwind's `fixed` positioning on the button. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Hermes assistant' : 'Open Hermes assistant'}
        className="fixed right-6 bottom-24 md:bottom-8 flex items-center justify-center rounded-full text-white font-bold text-lg select-none transition-transform duration-150 active:scale-95 hover:scale-105"
        style={{
          width: 56,
          height: 56,
          background: orbGradient,
          boxShadow: orbShadow,
          zIndex: 200,
        }}
      >
        <span className="hermes-orb flex items-center justify-center w-full h-full rounded-full">
          {open ? (
            <HugeiconsIcon icon={Cancel01Icon} size={22} strokeWidth={2} />
          ) : (
            <span className="leading-none" style={{ fontSize: 20, fontWeight: 700 }}>H</span>
          )}
        </span>
      </button>

      {/* ── Chat panel ── */}
      {/*
        Desktop: fixed bottom-right, 380×500, slides up
        Mobile:  full-width from bottom, 70% height
      */}
      <div
        role="dialog"
        aria-label="Hermes AI Assistant"
        aria-hidden={!open}
        className={[
          'fixed z-[199] flex flex-col',
          // Mobile: full width, 70vh, pinned to bottom
          'inset-x-0 bottom-0 w-full h-[70vh]',
          // md+: corner-anchored, fixed size
          'md:inset-auto md:right-6 md:bottom-[90px] md:w-[380px] md:h-[500px] md:rounded-2xl',
          // Desktop rounded
          'rounded-t-2xl',
          // Glass card
          'border border-[var(--theme-border)] shadow-2xl',
          // Slide transition
          open
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-4 opacity-0 pointer-events-none',
          'transition-all duration-200 ease-out',
        ].join(' ')}
        style={{
          background: 'var(--theme-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Panel header ── */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2.5">
            {/* Hermes avatar */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-[14px]"
              style={{ background: orbGradient, boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 35%, transparent)` }}
            >
              H
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--theme-text)]">Hermes</span>
                <HugeiconsIcon icon={SparklesIcon} size={12} style={{ color: 'var(--theme-accent)' }} />
              </div>
              <p className="text-[11px] text-[var(--theme-muted)]">AI Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Clear button */}
            <button
              onClick={handleClear}
              disabled={messages.length === 0}
              title="Clear history"
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: 'var(--theme-muted)' }}
            >
              <HugeiconsIcon icon={Delete01Icon} size={15} />
            </button>
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              title="Close"
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
              style={{ color: 'var(--theme-muted)' }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={15} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="flex flex-col gap-3">
            {/* Empty state */}
            {messages.length === 0 && !busy && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl"
                  style={{ background: orbGradient, boxShadow: `0 4px 18px color-mix(in srgb, ${brand.accentColor} 35%, transparent)` }}
                >
                  H
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[var(--theme-text)]">Hi, I'm Hermes</p>
                  <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">Ask me anything about your business</p>
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div
                    className="mr-2 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white font-bold text-[10px]"
                    style={{ background: orbGradient }}
                  >
                    H
                  </div>
                )}
                <div
                  className="max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed"
                  style={
                    m.role === 'user'
                      ? {
                          background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 72%, #000))`,
                          color: 'white',
                          boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 28%, transparent)`,
                          borderBottomRightRadius: 6,
                        }
                      : {
                          background: 'var(--theme-card)',
                          border: '1px solid var(--theme-border)',
                          color: 'var(--theme-text)',
                          backdropFilter: 'blur(10px)',
                          borderBottomLeftRadius: 6,
                        }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Loading / typing indicator */}
            {busy && (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white font-bold text-[10px]"
                  style={{ background: orbGradient }}
                >
                  <HugeiconsIcon icon={Loading03Icon} size={11} className="animate-spin" />
                </div>
                <div
                  className="rounded-2xl border px-3.5 py-2"
                  style={{
                    background: 'var(--theme-card)',
                    borderColor: 'var(--theme-border)',
                    backdropFilter: 'blur(10px)',
                    borderBottomLeftRadius: 6,
                  }}
                >
                  <LoadingDots accentColor={brand.accentColor} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Input bar ── */}
        <div
          className="shrink-0 border-t px-3 py-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder="Ask Hermes… (⏎ to send)"
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed outline-none transition-all"
              style={{
                background: 'var(--theme-input)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-accent)'
                e.currentTarget.style.boxShadow = 'var(--theme-glow)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || busy}
              className="shrink-0 flex items-center justify-center rounded-xl p-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: input.trim() && !busy ? orbGradient : 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                color: input.trim() && !busy ? 'white' : 'var(--theme-muted)',
                boxShadow: input.trim() && !busy ? `0 2px 10px color-mix(in srgb, ${brand.accentColor} 30%, transparent)` : 'none',
              }}
              title="Send"
            >
              <HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Backdrop on mobile (closes panel) ── */}
      {open && (
        <div
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 198, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
