import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  Mic01Icon,
  StopIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { VOICE_MODELS, BRAND_DEFAULT_VOICE, getVoiceModel, type VoiceModel } from '@/lib/voice-models'
import { toast } from '@/components/toast'

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Message { role: 'user' | 'assistant'; content: string }

function AvatarOrb({
  model,
  state,
  size = 200,
}: {
  model: VoiceModel
  state: VoiceState
  size?: number
}) {
  const pulseRings = state === 'listening' ? [0.85, 1.05, 1.25] : []

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Pulse rings for listening */}
      {pulseRings.map((scale, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle, ${model.color}22 0%, transparent 70%)`,
            animation: `orb-pulse ${1.2 + i * 0.4}s ease-out infinite`,
            animationDelay: `${i * 0.3}s`,
            transform: `scale(${scale})`,
          }}
        />
      ))}

      {/* Outer glow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: size - 8,
          height: size - 8,
          background: `conic-gradient(from 0deg, ${model.color}44, ${model.colorAlt}66, ${model.color}44)`,
          animation: state === 'thinking'
            ? 'orb-spin 1.4s linear infinite'
            : 'orb-spin 12s linear infinite',
          borderRadius: '50%',
        }}
      />

      {/* Middle ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: size - 20,
          height: size - 20,
          background: `conic-gradient(from 180deg, ${model.colorAlt}33, transparent, ${model.color}55)`,
          animation: state === 'thinking'
            ? 'orb-spin-rev 0.9s linear infinite'
            : 'orb-spin-rev 18s linear infinite',
        }}
      />

      {/* Core orb */}
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size - 36,
          height: size - 36,
          background: `radial-gradient(circle at 38% 35%, ${model.color}cc, ${model.colorAlt}99 55%, ${model.colorAlt}55 100%)`,
          boxShadow: `0 0 ${size * 0.3}px ${model.color}55, 0 0 ${size * 0.12}px ${model.color}88`,
          animation: state === 'idle' ? 'orb-breathe 3.5s ease-in-out infinite' : undefined,
        }}
      >
        {/* Inner reflection */}
        <div
          className="absolute rounded-full"
          style={{
            width: '40%',
            height: '35%',
            top: '18%',
            left: '22%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 100%)',
            transform: 'rotate(-30deg)',
          }}
        />

        {/* Wave bars for speaking */}
        {state === 'speaking' && (
          <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 4,
                  background: 'rgba(255,255,255,0.9)',
                  animation: `orb-wave 0.6s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.1}s`,
                  minHeight: 4,
                }}
              />
            ))}
          </div>
        )}

        {/* Emoji when idle/thinking */}
        {state !== 'speaking' && (
          <span
            className="select-none"
            style={{
              fontSize: size * 0.22,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
              animation: state === 'thinking' ? 'orb-breathe 0.8s ease-in-out infinite' : undefined,
            }}
          >
            {model.emoji}
          </span>
        )}
      </div>
    </div>
  )
}

function AvatarDots({
  models,
  selected,
  onSelect,
}: {
  models: VoiceModel[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      {models.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className="relative flex flex-col items-center gap-1 transition-transform active:scale-95"
          title={m.name}
        >
          <div
            className="rounded-full transition-all"
            style={{
              width: selected === m.id ? 36 : 28,
              height: selected === m.id ? 36 : 28,
              background: selected === m.id
                ? `radial-gradient(circle at 38% 35%, ${m.color}, ${m.colorAlt})`
                : `${m.color}44`,
              boxShadow: selected === m.id ? `0 0 12px ${m.color}88` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: selected === m.id ? 16 : 13,
            }}
          >
            {m.emoji}
          </div>
          {selected === m.id && (
            <span className="text-[9px] font-semibold" style={{ color: m.color }}>{m.name}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function VoiceScreen() {
  const brand = useBrand()
  const navigate = useNavigate()

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [selectedId, setSelectedId] = useState<string>(() => {
    try { return localStorage.getItem('hermes-voice-model') ?? '' } catch { return '' }
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [_transcript, setTranscript] = useState('')
  const [statusText, setStatusText] = useState('Tap to speak')
  const [muted, setMuted] = useState(false)
  const [saved, setSaved] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Load stored preference from server
  useEffect(() => {
    fetch('/api/voice/preference')
      .then(r => r.json())
      .then((d: { voice_model_id: string }) => {
        if (d.voice_model_id && !localStorage.getItem('hermes-voice-model')) {
          setSelectedId(d.voice_model_id)
        }
      })
      .catch(() => {})
  }, [])

  // Set brand default if nothing stored
  useEffect(() => {
    if (!selectedId) {
      setSelectedId(BRAND_DEFAULT_VOICE[brand.id] ?? 'marcus')
    }
  }, [brand.id, selectedId])

  const activeModel = getVoiceModel(selectedId)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }

  async function selectAvatar(id: string) {
    setSelectedId(id)
    try {
      localStorage.setItem('hermes-voice-model', id)
      await fetch('/api/voice/preference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_model_id: id }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {}
  }

  const speakText = useCallback(async (text: string) => {
    if (muted) return
    stopAudio()
    setVoiceState('speaking')
    setStatusText('Speaking…')
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_model_id: selectedId }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setVoiceState('idle')
        setStatusText('Tap to speak')
        audioRef.current = null
      }
      audio.onerror = () => {
        setVoiceState('idle')
        setStatusText('Tap to speak')
      }
      await audio.play()
    } catch {
      // fallback to Web Speech API
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utt = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, '').replace(/[*_~`#]/g, ''))
        const voices = window.speechSynthesis.getVoices()
        const preferred = voices.find(v =>
          /samantha|karen|google.*us|microsoft.*zira|enhanced/i.test(v.name)
        )
        if (preferred) utt.voice = preferred
        utt.rate = 1.05
        utt.onend = () => { setVoiceState('idle'); setStatusText('Tap to speak') }
        window.speechSynthesis.speak(utt)
      } else {
        setVoiceState('idle')
        setStatusText('Tap to speak')
      }
    }
  }, [muted, selectedId])

  function clearSilenceTracking() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    analyserRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
  }

  async function startListening() {
    if (voiceState === 'thinking' || voiceState === 'listening') return
    stopAudio()
    clearSilenceTracking()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      mediaRecorderRef.current = mr
      setVoiceState('listening')
      setStatusText('Listening… (auto-sends after 5s silence)')
      setTranscript('')

      // Silence detection via WebAudio AnalyserNode
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      let silenceStart: number | null = null

      function checkSilence() {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        if (avg < 6) {
          if (silenceStart === null) silenceStart = Date.now()
          else if (Date.now() - silenceStart >= 5000) {
            clearSilenceTracking()
            void stopListening()
            return
          }
        } else {
          silenceStart = null
        }
        rafRef.current = requestAnimationFrame(checkSilence)
      }
      rafRef.current = requestAnimationFrame(checkSilence)
    } catch {
      toast('Microphone access denied', { type: 'error' })
    }
  }

  async function stopListening() {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    setVoiceState('thinking')
    setStatusText('Thinking…')

    const audioBlob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
      mr.stop()
      mr.stream.getTracks().forEach(t => t.stop())
    })
    mediaRecorderRef.current = null

    if (audioBlob.size < 500) {
      setVoiceState('idle')
      setStatusText('Tap to speak')
      return
    }

    try {
      // Transcribe
      const fd = new FormData()
      fd.append('audio', audioBlob, 'voice.webm')
      const txRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const txData = await txRes.json() as { text?: string; error?: string }
      const userText = txData.text?.trim()
      if (!userText) {
        setVoiceState('idle')
        setStatusText('Tap to speak')
        return
      }
      setTranscript(userText)

      const newMessages: Message[] = [...messages, { role: 'user', content: userText }]
      setMessages(newMessages)

      // Chat with Hermes
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.slice(-8) }),
      })
      const chatData = await chatRes.json() as { reply?: string; error?: string }
      const reply = chatData.reply?.trim()
      if (!reply) {
        setVoiceState('idle')
        setStatusText('Tap to speak')
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      await speakText(reply)
    } catch (e) {
      toast((e as Error).message, { type: 'error' })
      setVoiceState('idle')
      setStatusText('Tap to speak')
    }
  }

  // Single-tap toggle
  function onMicTap(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (voiceState === 'idle') {
      void startListening()
    } else if (voiceState === 'listening') {
      clearSilenceTracking()
      void stopListening()
    } else if (voiceState === 'speaking') {
      stopAudio()
      setVoiceState('idle')
      setStatusText('Tap to speak')
    }
  }

  const statusColor = {
    idle: 'var(--theme-muted)',
    listening: activeModel.color,
    thinking: 'var(--theme-accent)',
    speaking: activeModel.color,
  }[voiceState]

  const recentMessages = messages.slice(-6)
  const isActive = voiceState === 'listening'

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes orb-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes orb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orb-spin-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes orb-wave {
          from { height: 4px; }
          to { height: 28px; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 flex flex-col overflow-hidden"
        style={{ background: 'var(--theme-bg)', zIndex: 50 }}
      >
        {/* Ambient background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 55% at 50% 40%, ${activeModel.color}18 0%, transparent 70%)`,
            transition: 'background 0.6s ease',
          }}
        />

        {/* Top nav */}
        <div className="relative flex items-center justify-between px-5 pt-safe-top pb-3 pt-4">
          <button
            onClick={() => navigate({ to: '/chat' })}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'var(--theme-card)' }}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} style={{ color: 'var(--theme-text)' }} />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
              Voice
            </span>
            <span className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>
              Hermes AI
            </span>
          </div>

          <button
            onClick={() => { stopAudio(); setMuted(m => !m) }}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'var(--theme-card)' }}
          >
            <HugeiconsIcon
              icon={muted ? VolumeOffIcon : VolumeHighIcon}
              size={18}
              style={{ color: muted ? 'var(--theme-muted)' : 'var(--theme-text)' }}
            />
          </button>
        </div>

        {/* Avatar orb */}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
          <AvatarOrb model={activeModel} state={voiceState} size={190} />

          {/* Name + tagline */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[22px] font-bold tracking-tight"
                style={{ color: 'var(--theme-text)' }}
              >
                {activeModel.name}
              </span>
              {saved && (
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={16}
                  style={{ color: activeModel.color, animation: 'fade-in-up 0.3s ease' }}
                />
              )}
            </div>
            <span className="text-[12px]" style={{ color: 'var(--theme-muted)' }}>
              {activeModel.tagline}
            </span>
          </div>

          {/* Status text */}
          <p
            className="text-[13px] font-medium transition-all"
            style={{ color: statusColor, minHeight: 20 }}
          >
            {statusText}
          </p>

          {/* Avatar selector */}
          <AvatarDots
            models={VOICE_MODELS}
            selected={selectedId}
            onSelect={selectAvatar}
          />
        </div>

        {/* Transcript */}
        {recentMessages.length > 0 && (
          <div
            ref={transcriptRef}
            className="mx-4 max-h-[180px] overflow-y-auto rounded-2xl p-4"
            style={{
              background: 'var(--theme-card)',
              borderColor: 'var(--theme-border)',
              border: '1px solid var(--theme-border)',
            }}
          >
            <div className="flex flex-col gap-2">
              {recentMessages.map((m, i) => (
                <div
                  key={i}
                  className="flex"
                  style={{
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    animation: 'fade-in-up 0.25s ease',
                  }}
                >
                  <div
                    className="max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed"
                    style={
                      m.role === 'user'
                        ? {
                            background: `${activeModel.color}22`,
                            color: 'var(--theme-text)',
                            borderBottomRightRadius: 4,
                          }
                        : {
                            background: 'var(--theme-bg)',
                            color: 'var(--theme-text)',
                            borderBottomLeftRadius: 4,
                          }
                    }
                  >
                    {m.content.length > 220 ? m.content.slice(0, 220) + '…' : m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Talk button */}
        <div className="flex flex-col items-center gap-3 pb-safe-bottom px-6 py-6">
          {/* Clear history */}
          {messages.length > 0 && voiceState === 'idle' && (
            <button
              onClick={() => setMessages([])}
              className="text-[11px]"
              style={{ color: 'var(--theme-muted)' }}
            >
              Clear conversation
            </button>
          )}

          <button
            onClick={onMicTap}
            disabled={voiceState === 'thinking'}
            className="relative flex h-20 w-20 items-center justify-center rounded-full transition-all select-none"
            style={{
              background: isActive
                ? `radial-gradient(circle, ${activeModel.color}, ${activeModel.colorAlt})`
                : voiceState === 'thinking'
                  ? 'var(--theme-card)'
                  : `${activeModel.color}22`,
              boxShadow: isActive
                ? `0 0 30px ${activeModel.color}88, 0 0 60px ${activeModel.color}44`
                : 'none',
              border: `2px solid ${isActive ? activeModel.color : activeModel.color + '55'}`,
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              cursor: voiceState === 'thinking' ? 'not-allowed' : 'pointer',
            }}
          >
            {voiceState === 'thinking' ? (
              <div
                className="h-6 w-6 rounded-full border-2 border-t-transparent"
                style={{
                  borderColor: `${activeModel.color} transparent transparent transparent`,
                  animation: 'orb-spin 0.7s linear infinite',
                }}
              />
            ) : voiceState === 'speaking' ? (
              <HugeiconsIcon icon={StopIcon} size={28} style={{ color: isActive ? 'white' : activeModel.color }} />
            ) : (
              <HugeiconsIcon
                icon={Mic01Icon}
                size={32}
                style={{ color: isActive ? 'white' : activeModel.color }}
              />
            )}
          </button>

          <p className="text-[11px]" style={{ color: 'var(--theme-muted)' }}>
            {voiceState === 'listening'
              ? 'Auto-sends after 5s silence · tap to send now'
              : voiceState === 'thinking'
                ? 'Processing…'
                : voiceState === 'speaking'
                  ? 'Tap to interrupt'
                  : 'Tap to speak'}
          </p>
        </div>
      </div>
    </>
  )
}
