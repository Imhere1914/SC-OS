import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { SentIcon, Mic01Icon, AiMagicIcon } from '@hugeicons/core-free-icons'
import { sendChat, type ChatMessage } from '@/lib/chat-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

const SUGGESTIONS = [
  'Summarize my new leads',
  'Draft a welcome campaign',
  'What appointments are coming up?',
  'Write a social post about our services',
]

export function ChatScreen() {
  const brand = useBrand()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceOut, setVoiceOut] = useState(false)
  const recogRef = useRef<unknown>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  function speak(text: string) {
    if (!voiceOut || typeof window === 'undefined' || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  async function submit(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const { reply } = await sendChat(next)
      setMessages([...next, { role: 'assistant', content: reply }])
      speak(reply)
    } catch (e) {
      toast((e as Error).message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  function toggleVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (!Ctor) {
      toast('Voice input not supported in this browser', { type: 'error' })
      return
    }
    if (listening) {
      ;(recogRef.current as { stop?: () => void })?.stop?.()
      setListening(false)
      return
    }
    const recog = new Ctor() as {
      lang: string; interimResults: boolean; continuous: boolean
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
      onend: () => void; onerror: () => void; start: () => void
    }
    recog.lang = 'en-US'
    recog.interimResults = false
    recog.continuous = false
    recog.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? ''
      if (t) submit(t)
    }
    recog.onend = () => setListening(false)
    recog.onerror = () => setListening(false)
    recogRef.current = recog
    setListening(true)
    recog.start()
  }

  return (
    <div className="flex h-full flex-col bg-[var(--theme-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiMagicIcon} size={20} className="text-[var(--theme-accent)]" />
          <h1 className="text-lg font-semibold text-[var(--theme-text)]">{brand.shortName} Assistant</h1>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--theme-muted)]">
          <input type="checkbox" checked={voiceOut} onChange={(e) => setVoiceOut(e.target.checked)} />
          Speak replies
        </label>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <HugeiconsIcon icon={AiMagicIcon} size={40} className="text-[var(--theme-accent)]" />
              <p className="text-[var(--theme-text)]">Hi! I'm your {brand.name} assistant. Ask me to manage anything across your business.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1.5 text-sm text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-[var(--theme-accent)] text-white'
                    : 'border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-[var(--theme-muted)]">Thinking…</div>}
        </div>
      </div>

      <div className="border-t border-[var(--theme-border)] px-6 py-4">
        <div className="mx-auto flex w-full max-w-[760px] items-end gap-2">
          <button
            onClick={toggleVoice}
            className={`shrink-0 rounded-xl border p-2.5 transition-colors ${
              listening
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white'
                : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]'
            }`}
            title="Voice input"
          >
            <HugeiconsIcon icon={Mic01Icon} size={18} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(input)
              }
            }}
            placeholder={listening ? 'Listening…' : 'Message your assistant…'}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-4 py-2.5 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || busy}
            className="shrink-0 rounded-xl bg-[var(--theme-accent)] p-2.5 text-white disabled:opacity-50"
            title="Send"
          >
            <HugeiconsIcon icon={SentIcon} size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
