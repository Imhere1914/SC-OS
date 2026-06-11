import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { SentIcon, Mic01Icon, AiMagicIcon, VolumeHighIcon, VolumeOffIcon } from '@hugeicons/core-free-icons'
import { sendChat, type ChatMessage } from '@/lib/chat-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

const SUGGESTIONS = [
  'Show me my open deals',
  'Generate an image of a modern office hero banner',
  'What appointments do I have coming up?',
  'Give me a business summary',
]

const MEDIA_IMAGE_URL_RE = /\/api\/media\/file\/[\w.-]+\.(?:png|jpg|jpeg|webp)/g

function extractImageUrls(content: string): string[] {
  return [...new Set(content.match(MEDIA_IMAGE_URL_RE) ?? [])]
}

type ChatStatus = { backend: string; model: string; live: boolean }

function RecordingVisualizer({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="flex items-center gap-[3px] px-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current"
          style={{
            height: `${8 + Math.random() * 12}px`,
            animation: `wave 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
      <style>{`@keyframes wave { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
    </div>
  )
}

export function ChatScreen() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceOut, setVoiceOut] = useState(() => {
    try { return localStorage.getItem('hermes-voice-out') === '1' } catch { return false }
  })
  const [speaking, setSpeaking] = useState(false)
  const recogRef = useRef<unknown>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: status } = useQuery<ChatStatus>({
    queryKey: ['chat-status'],
    queryFn: () => fetch('/api/chat/status').then(r => r.json()),
    staleTime: 30_000,
  })

  function setVoiceOutPersist(v: boolean) {
    setVoiceOut(v)
    try { localStorage.setItem('hermes-voice-out', v ? '1' : '0') } catch { /* noop */ }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  const speak = useCallback(async (text: string) => {
    if (!voiceOut || !text) return
    stopSpeaking()
    setSpeaking(true)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok && res.body) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url) }
        await audio.play()
        return
      }
    } catch { /* server TTS unavailable, fall through */ }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const cleaned = text.replace(/```[\s\S]*?```/g, '').replace(/[*_~#`]/g, '').trim()
      if (!cleaned) { setSpeaking(false); return }
      const u = new SpeechSynthesisUtterance(cleaned.slice(0, 2000))
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => /samantha|karen|google.*us|microsoft.*zira|enhanced/i.test(v.name))
        ?? voices.find(v => v.lang.startsWith('en') && !v.localService)
        ?? voices.find(v => v.lang.startsWith('en'))
      if (preferred) u.voice = preferred
      u.rate = 1.05
      u.pitch = 1.0
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } else {
      setSpeaking(false)
    }
  }, [voiceOut])

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
      void speak(reply)
    } catch (e) {
      toast((e as Error).message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function toggleVoice() {
    if (listening) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      } else {
        ;(recogRef.current as { stop?: () => void })?.stop?.()
      }
      setListening(false)
      return
    }

    // Auto-enable voice replies when user speaks
    if (!voiceOut) setVoiceOutPersist(true)

    // Try MediaRecorder + Whisper first
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        audioChunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          if (audioBlob.size < 1000) return // too short, skip

          setBusy(true)
          try {
            const fd = new FormData()
            fd.append('audio', audioBlob, 'audio.webm')
            const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
            const data = await res.json() as { transcript?: string; error?: string }
            if (data.transcript?.trim()) {
              await submit(data.transcript.trim())
            } else if (data.error) {
              // Silently fall through — transcription failed
            }
          } catch {
            // transcription failed silently
          } finally {
            setBusy(false)
          }
        }

        mediaRecorderRef.current = recorder
        recorder.start()
        setListening(true)

        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
            setListening(false)
          }
        }, 30_000)
        return
      } catch {
        // Mic permission denied or MediaRecorder not supported — fall through to Web Speech
      }
    }

    // Fallback: Web Speech API
    const W = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (!Ctor) {
      toast('Voice input not supported in this browser', { type: 'error' })
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-6 py-3.5"
        style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-sidebar-border)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
              boxShadow: `0 2px 8px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`,
            }}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-[13px] font-semibold text-[var(--theme-text)]">{brand.shortName} Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: status?.live ? 'var(--theme-success)' : 'var(--theme-muted)' }}
              />
              <p className="text-[11px] text-[var(--theme-muted)]">
                {status ? (status.live ? status.model : 'offline mode') : 'connecting…'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
              style={{ background: 'color-mix(in srgb, var(--theme-accent) 15%, transparent)', color: 'var(--theme-accent)' }}
            >
              Stop
            </button>
          )}
          <button
            onClick={() => navigate({ to: '/voice' })}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all"
            style={{
              borderColor: 'var(--theme-border)',
              background: 'transparent',
              color: 'var(--theme-muted)',
            }}
            title="Open voice capture"
          >
            <HugeiconsIcon icon={Mic01Icon} size={14} />
            <span className="hidden sm:inline">Voice</span>
          </button>
          <button
            onClick={() => setVoiceOutPersist(!voiceOut)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all"
            style={{
              borderColor: voiceOut ? 'var(--theme-accent)' : 'var(--theme-border)',
              background: voiceOut ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'transparent',
              color: voiceOut ? 'var(--theme-accent)' : 'var(--theme-muted)',
            }}
            title={voiceOut ? 'Voice replies on' : 'Voice replies off'}
          >
            <HugeiconsIcon icon={voiceOut ? VolumeHighIcon : VolumeOffIcon} size={14} />
            <span className="hidden sm:inline">{voiceOut ? 'Voice on' : 'Voice off'}</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-5 py-14 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 60%, #000))`,
                  boxShadow: `0 4px 24px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
                }}
              >
                <HugeiconsIcon icon={AiMagicIcon} size={26} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">Hi, I'm your {brand.name} assistant</h2>
                <p className="mt-1 text-[13px] text-[var(--theme-muted)]">Ask me to manage anything across your business</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-3.5 py-1.5 text-[12px] text-[var(--theme-muted)] backdrop-blur-sm transition-all hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div
                  className="mr-2.5 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                  }}
                >
                  <HugeiconsIcon icon={AiMagicIcon} size={12} className="text-white" />
                </div>
              )}
              <div
                className="max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
                style={
                  m.role === 'user'
                    ? {
                        background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 72%, #000))`,
                        color: 'white',
                        boxShadow: `0 2px 14px color-mix(in srgb, ${brand.accentColor} 30%, transparent)`,
                        borderBottomRightRadius: '6px',
                      }
                    : {
                        background: 'var(--theme-card)',
                        border: '1px solid var(--theme-border)',
                        color: 'var(--theme-text)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        backdropFilter: 'blur(10px)',
                        borderBottomLeftRadius: '6px',
                      }
                }
              >
                {m.content}
                {m.role === 'assistant' && extractImageUrls(m.content).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-2 block">
                    <img
                      src={url}
                      alt="Generated image"
                      className="max-h-64 rounded-xl border"
                      style={{ borderColor: 'var(--theme-border)' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {busy && (
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))` }}
              >
                <HugeiconsIcon icon={AiMagicIcon} size={12} className="text-white" />
              </div>
              <div
                className="flex gap-1 rounded-2xl border border-[var(--theme-border)] px-4 py-3"
                style={{ background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full animate-bounce"
                    style={{
                      background: 'var(--theme-accent)',
                      animationDelay: `${d * 0.15}s`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div
        className="border-t px-6 py-4"
        style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-sidebar-border)', backdropFilter: 'blur(16px)' }}
      >
        <div className="mx-auto flex w-full max-w-[720px] items-end gap-2.5">
          <button
            onClick={toggleVoice}
            className="shrink-0 rounded-xl border p-2.5 transition-all"
            style={
              listening
                ? {
                    background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                    borderColor: 'transparent',
                    color: 'white',
                    boxShadow: `0 2px 12px color-mix(in srgb, ${brand.accentColor} 40%, transparent)`,
                    minWidth: '60px',
                  }
                : { borderColor: 'var(--theme-border)', color: 'var(--theme-muted)', background: 'var(--theme-card)' }
            }
            title={listening ? 'Stop recording' : 'Voice input'}
          >
            {listening ? <RecordingVisualizer active={true} /> : <HugeiconsIcon icon={Mic01Icon} size={17} />}
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
            placeholder={listening ? '🎙 Recording… tap mic to send' : 'Message your assistant… (⏎ to send)'}
            rows={1}
            className="max-h-36 flex-1 resize-none rounded-xl border px-4 py-2.5 text-[13px] leading-relaxed outline-none transition-all"
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
            onClick={() => submit(input)}
            disabled={!input.trim() || busy}
            className="btn-primary shrink-0 rounded-xl p-2.5"
          >
            <HugeiconsIcon icon={SentIcon} size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
