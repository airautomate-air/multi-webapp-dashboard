// app/positive-vibes/page.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Mic, MicOff, Sparkles, FileText, Send } from "lucide-react"
import PositiveVibesGlobe from "@/components/positive-vibes-globe"

interface Message {
  role: "user" | "model"
  content: string
}

type VoiceState = "idle" | "listening" | "speaking"

function getStoredQuote(): { q: string; a: string } {
  if (typeof window === "undefined") return { q: "Breathe. This too shall pass.", a: "Unknown" }
  try {
    const quotes = JSON.parse(localStorage.getItem("positive_vibes_quotes") ?? "[]")
    const index = parseInt(localStorage.getItem("positive_vibes_index") ?? "0", 10)
    return quotes[isNaN(index) ? 0 : index] ?? { q: "Breathe. This too shall pass.", a: "Unknown" }
  } catch {
    return { q: "Breathe. This too shall pass.", a: "Unknown" }
  }
}

export default function PositiveVibesPage() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [quote, setQuote] = useState({ q: "Breathe. This too shall pass.", a: "Unknown" })
  const [textInput, setTextInput] = useState("")

  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const levelRafRef = useRef<number>(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const utteranceQueueRef = useRef<string[]>([])
  const speakingRef = useRef(false)
  const autoLoopRef = useRef(true)
  const voiceStateRef = useRef<VoiceState>("idle")
  const speakNextRef = useRef<() => void>(() => {})
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => { voiceStateRef.current = voiceState }, [voiceState])

  useEffect(() => {
    setQuote(getStoredQuote())
    return () => {
      abortRef.current?.abort()
      stopMic()
      synthRef.current?.cancel()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mic cleanup ─────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    cancelAnimationFrame(levelRafRef.current)
    setAudioLevel(0)
    // Null handlers before stopping so onstop doesn't trigger transcription
    if (recorderRef.current) {
      recorderRef.current.onstop = null
      recorderRef.current.ondataavailable = null
      if (recorderRef.current.state !== "inactive") recorderRef.current.stop()
      recorderRef.current = null
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
  }, [])

  // ── Start listening (MediaRecorder + Gemini transcription) ──────────
  const startListening = useCallback(async () => {
    // Clean up previous recorder without triggering transcription
    if (recorderRef.current) {
      recorderRef.current.onstop = null
      recorderRef.current.ondataavailable = null
      if (recorderRef.current.state !== "inactive") recorderRef.current.stop()
      recorderRef.current = null
    }
    cancelAnimationFrame(levelRafRef.current)
    setAudioLevel(0)
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null

    setError(null)
    setVoiceState("listening")

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError("Microphone access denied.")
      setVoiceState("idle")
      return
    }
    micStreamRef.current = stream

    // Web Audio for level meter
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser

    // MediaRecorder
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = async () => {
      // Clean up audio resources
      cancelAnimationFrame(levelRafRef.current)
      setAudioLevel(0)
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
      audioCtxRef.current?.close()
      audioCtxRef.current = null
      analyserRef.current = null

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })

      // Too short = just noise, retry
      if (blob.size < 1500) {
        if (autoLoopRef.current && voiceStateRef.current !== "idle") startListening()
        return
      }

      const fd = new FormData()
      fd.append("audio", blob, "audio.webm")

      try {
        const res = await fetch("/api/positive-vibes/transcribe", {
          method: "POST",
          body: fd,
        })
        const data = await res.json()
        const text = (data.text ?? "").trim()
        if (!text) {
          if (autoLoopRef.current && voiceStateRef.current !== "idle") startListening()
          return
        }
        await sendMessageRef.current(text)
      } catch {
        if (autoLoopRef.current && voiceStateRef.current !== "idle") startListening()
      }
    }

    recorder.start()

    // Combined level tracking + silence detection
    const buf = new Uint8Array(analyser.frequencyBinCount)
    let silenceStart: number | null = null
    let speechDetected = false
    const SPEECH_THRESHOLD = 15   // avg energy to count as speech start
    const SILENCE_THRESHOLD = 8   // avg energy to count as silence
    const SILENCE_DURATION = 1800 // ms of silence before auto-stop

    const tick = () => {
      if (!analyserRef.current || recorderRef.current !== recorder) return
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length
      setAudioLevel(Math.min(1, avg / 100))

      // Wait for initial speech before counting silence
      if (avg > SPEECH_THRESHOLD) speechDetected = true

      if (speechDetected) {
        if (avg < SILENCE_THRESHOLD) {
          if (silenceStart === null) silenceStart = Date.now()
          else if (Date.now() - silenceStart >= SILENCE_DURATION) {
            recorder.stop()
            return
          }
        } else {
          silenceStart = null
        }
      }

      levelRafRef.current = requestAnimationFrame(tick)
    }
    levelRafRef.current = requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── TTS ─────────────────────────────────────────────────────────────
  const speakNext = useCallback(() => {
    const synth = synthRef.current
    if (!synth || utteranceQueueRef.current.length === 0) {
      speakingRef.current = false
      setAudioLevel(0)
      if (autoLoopRef.current) startListening()
      return
    }
    speakingRef.current = true
    const text = utteranceQueueRef.current.shift()!
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95
    utt.pitch = 1.0
    utt.onboundary = () => setAudioLevel(0.55 + Math.random() * 0.35)
    utt.onend = () => { setAudioLevel(0); speakNextRef.current() }
    utt.onerror = () => { setAudioLevel(0); speakNextRef.current() }
    synth.speak(utt)
  }, [startListening])

  useEffect(() => { speakNextRef.current = speakNext }, [speakNext])

  const speakQueue = useCallback((sentences: string[]) => {
    utteranceQueueRef.current.push(...sentences)
    if (speakingRef.current) return
    speakNextRef.current()
  }, [])

  // ── Send message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { role: "user", content: text }
    const updatedTranscript = [...transcript, userMsg]
    setTranscript(updatedTranscript)
    setVoiceState("speaking")
    setDocUrl(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    utteranceQueueRef.current = []
    speakingRef.current = false

    try {
      const res = await fetch("/api/positive-vibes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedTranscript }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Coach is unavailable right now")
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullReply = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        fullReply += chunk

        const sentenceEnd = /[.!?。]\s*/g
        let match: RegExpExecArray | null
        let last = 0
        while ((match = sentenceEnd.exec(buffer)) !== null) {
          const sentence = buffer.slice(last, match.index + match[0].length).trim()
          if (sentence) speakQueue([sentence])
          last = match.index + match[0].length
        }
        buffer = buffer.slice(last)
      }

      if (buffer.trim()) speakQueue([buffer.trim()])
      setTranscript((prev) => [...prev, { role: "model", content: fullReply }])
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Something went wrong")
      setVoiceState("idle")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, speakQueue])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Mic toggle ──────────────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (voiceState === "idle") {
      autoLoopRef.current = true
      startListening()
    } else {
      autoLoopRef.current = false
      abortRef.current?.abort()
      synthRef.current?.cancel()
      stopMic()
      speakingRef.current = false
      utteranceQueueRef.current = []
      setVoiceState("idle")
      setAudioLevel(0)
    }
  }, [voiceState, startListening, stopMic])

  // ── Save to Google Docs ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (transcript.length === 0) return
    setSavingDoc(true)
    try {
      const res = await fetch("/api/positive-vibes/save-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDocUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transcript")
    } finally {
      setSavingDoc(false)
    }
  }, [transcript])

  // ── Text submit ─────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim()
    if (!text || voiceState === "speaking") return
    setTextInput("")
    if (voiceState !== "idle") {
      autoLoopRef.current = false
      synthRef.current?.cancel()
      stopMic()
      speakingRef.current = false
      utteranceQueueRef.current = []
      setVoiceState("idle")
      setAudioLevel(0)
    }
    await sendMessageRef.current(text)
  }, [textInput, voiceState, stopMic])

  // ── Auto-scroll transcript ──────────────────────────────────────────
  const transcriptBottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  const statusLabel =
    voiceState === "listening" ? "Listening…" :
    voiceState === "speaking"  ? "Speaking…" :
    transcript.length > 0      ? "Tap to continue" :
                                 "Tap to begin"

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "linear-gradient(160deg, #0d1a0f 0%, #0a1520 50%, #1a1a0a 100%)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "#4a7c59" }} />
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Positive Vibes
          </span>
        </div>
        <span
          className="ml-auto text-xs italic hidden sm:block"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          You&apos;re not alone in this.
        </span>
      </header>

      {/* Split body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Globe (2/3) ── */}
        <div
          className="flex flex-col items-center justify-center gap-6 shrink-0"
          style={{
            width: "66.666%",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            padding: "24px 16px",
          }}
        >
          <p
            className="text-xs italic text-center max-w-xs"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            ✦ &ldquo;{quote.q}&rdquo; — {quote.a}
          </p>

          <PositiveVibesGlobe state={voiceState} audioLevel={audioLevel} size={320} />

          <p className="text-xs tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
            {statusLabel}
          </p>

          <button
            onClick={handleMicToggle}
            className="flex items-center justify-center rounded-full transition-all duration-200"
            style={{
              width: 60,
              height: 60,
              background: voiceState !== "idle" ? "rgba(255,255,255,0.12)" : "rgba(74,124,89,0.8)",
              border: `2px solid ${voiceState !== "idle" ? "rgba(255,255,255,0.2)" : "rgba(74,124,89,0.6)"}`,
              boxShadow: voiceState !== "idle"
                ? "0 0 16px rgba(255,255,255,0.06)"
                : "0 0 16px rgba(74,124,89,0.3)",
            }}
            aria-label={voiceState !== "idle" ? "Stop" : "Start listening"}
          >
            {voiceState !== "idle"
              ? <MicOff size={22} style={{ color: "rgba(255,255,255,0.7)" }} />
              : <Mic size={22} style={{ color: "#fff" }} />
            }
          </button>

          {error && (
            <p className="text-xs text-center max-w-xs" style={{ color: "#f5a623" }}>
              {error}
            </p>
          )}
        </div>

        {/* ── Right: Transcript (1/3) ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
            {transcript.length === 0 && (
              <p
                className="text-xs text-center mt-12"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                Your conversation will appear here.
              </p>
            )}
            {transcript.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[90%] px-3 py-2 text-xs leading-relaxed"
                  style={msg.role === "user" ? {
                    background: "rgba(74,124,89,0.35)",
                    border: "1px solid rgba(74,124,89,0.4)",
                    borderRadius: "10px 10px 2px 10px",
                    color: "rgba(255,255,255,0.85)",
                  } : {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "2px 10px 10px 10px",
                    color: "rgba(255,255,255,0.7)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {voiceState === "speaking" &&
              transcript.length > 0 &&
              transcript[transcript.length - 1].role === "user" && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "2px 10px 10px 10px",
                  }}
                >
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: "rgba(255,255,255,0.3)", animationDelay: `${j * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={transcriptBottomRef} />
          </div>

          {/* Input bar */}
          <div
            className="shrink-0 px-3 py-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit() }}
                placeholder="Type a message…"
                disabled={voiceState === "speaking"}
                className="flex-1 text-xs outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "rgba(255,255,255,0.8)",
                }}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || voiceState === "speaking"}
                className="flex items-center justify-center rounded-full shrink-0 transition-opacity disabled:opacity-30"
                style={{ width: 34, height: 34, background: "rgba(74,124,89,0.7)" }}
                aria-label="Send"
              >
                <Send size={13} style={{ color: "#fff" }} />
              </button>
            </div>

            {transcript.length > 0 && voiceState === "idle" && (
              <div className="flex justify-end">
                {docUrl ? (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    Open in Google Docs ↗
                  </a>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={savingDoc}
                    className="flex items-center gap-1.5 text-xs transition-opacity disabled:opacity-40"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <FileText size={11} />
                    {savingDoc ? "Saving…" : "Save to Google Docs"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
