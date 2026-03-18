"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  ArrowLeft,
  Mic,
  Square,
  ExternalLink,
  TableProperties,
  CheckSquare,
  FileText,
  Loader2,
} from "lucide-react"

interface MeetingSummary {
  title: string
  summary: string
  tasks: string[]
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

type Mode = "idle" | "recording-speech" | "recording-audio" | "transcribing" | "summarizing" | "done"

export default function MeetingPage() {
  const { data: session } = useSession()
  const [mode, setMode] = useState<Mode>("idle")
  const [transcript, setTranscript] = useState("")
  const [interimText, setInterimText] = useState("")
  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [savingSheets, setSavingSheets] = useState(false)
  const [sheetsLink, setSheetsLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef("")
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript, interimText])

  const startTimer = () => {
    setDuration(0)
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // --- Web Speech API path ---
  const startSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      startMediaRecorder()
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let finalChunk = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) finalChunk += text + " "
        else interim += text
      }
      if (finalChunk) {
        transcriptRef.current += finalChunk
        setTranscript(transcriptRef.current)
      }
      setInterimText(interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "network" || event.error === "not-allowed") {
        // Fall back to audio recording
        recognition.onend = null
        recognition.stop()
        recognitionRef.current = null
        stopTimer()
        setTranscript("")
        setInterimText("")
        transcriptRef.current = ""
        startMediaRecorder()
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognition.start() } catch { /* stopped */ }
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setMode("recording-speech")
    startTimer()
  }

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopTimer()
    setInterimText("")
  }

  // --- MediaRecorder fallback path ---
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setMode("recording-audio")
      startTimer()
    } catch {
      setError("Could not access microphone. Please allow microphone permission.")
    }
  }

  const stopMediaRecorder = (): Promise<void> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) { resolve(); return }

      recorder.onstop = async () => {
        const stream = recorder.stream
        stream.getTracks().forEach((t) => t.stop())
        mediaRecorderRef.current = null

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        stopTimer()
        setMode("transcribing")

        try {
          const arrayBuffer = await audioBlob.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString("base64")

          const res = await fetch("/api/meeting/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType: recorder.mimeType }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.detail || data.error)
          transcriptRef.current = data.transcript
          setTranscript(data.transcript)
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Transcription failed")
          setMode("idle")
        }
        resolve()
      }

      recorder.stop()
    })
  }

  // --- Main controls ---
  const handleStart = () => {
    setError(null)
    setSummary(null)
    setSheetsLink(null)
    setTranscript("")
    setInterimText("")
    transcriptRef.current = ""
    startSpeechRecognition()
  }

  const handleStop = async () => {
    if (mode === "recording-speech") {
      stopSpeechRecognition()
      const finalTranscript = transcriptRef.current.trim()
      if (!finalTranscript) {
        setError("No speech detected. Please try again.")
        setMode("idle")
        return
      }
      setMode("summarizing")
      await summarize(finalTranscript)
    } else if (mode === "recording-audio") {
      await stopMediaRecorder()
      const finalTranscript = transcriptRef.current.trim()
      if (!finalTranscript) {
        setError("No speech detected in recording.")
        setMode("idle")
        return
      }
      setMode("summarizing")
      await summarize(finalTranscript)
    }
  }

  const summarize = async (text: string) => {
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to summarize")
      setSummary(data)
      setMode("done")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setMode("idle")
    }
  }

  const handleSaveToSheets = async () => {
    if (!summary) return
    setSavingSheets(true)
    setError(null)
    try {
      const res = await fetch("/api/meeting/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: summary.title,
          summary: summary.summary,
          tasks: summary.tasks,
          transcript: transcriptRef.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to save")
      setSheetsLink(data.sheetsLink)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSavingSheets(false)
    }
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const isRecording = mode === "recording-speech" || mode === "recording-audio"
  const isProcessing = mode === "transcribing" || mode === "summarizing"

  const statusLabel = {
    idle: "Press to start transcribing",
    "recording-speech": `Recording (live) — ${formatDuration(duration)}`,
    "recording-audio": `Recording — ${formatDuration(duration)}`,
    transcribing: "Transcribing audio with AI...",
    summarizing: "Analyzing meeting with AI...",
    done: "Recording complete",
  }[mode]

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <span className="text-stone-300">|</span>
          <div className="flex items-center gap-2">
            <Mic size={16} className="text-stone-700" />
            <span
              className="text-lg font-semibold text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Meeting Transcription
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div className="mb-10">
          <h1
            className="text-4xl font-light text-stone-900 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Transcribe Your Meeting
          </h1>
          <p className="text-stone-500">
            Press start, speak, and get an AI-generated summary with action
            items saved to Google Sheets.
          </p>
        </div>

        {/* Recording control */}
        <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-6">
          <div className="relative">
            {isRecording && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
                <span className="absolute -inset-3 rounded-full bg-red-300 animate-ping opacity-15" />
              </>
            )}
            <button
              onClick={isRecording ? handleStop : handleStart}
              disabled={isProcessing}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-stone-900 hover:bg-stone-700 text-white"
              }`}
            >
              {isRecording ? <Square size={28} /> : <Mic size={28} />}
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex items-center gap-2 text-sm font-medium ${
                isRecording ? "text-red-500" : "text-stone-500"
              }`}
            >
              {isRecording && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {isProcessing && <Loader2 size={14} className="animate-spin text-stone-400" />}
              {statusLabel}
            </div>
            {isRecording && (
              <p className="text-xs text-stone-400">
                {mode === "recording-speech"
                  ? "Live transcription active — press stop when done"
                  : "Audio recording active — press stop when done"}
              </p>
            )}
          </div>
        </div>

        {/* Live transcript */}
        {(isRecording || transcript) && (
          <div className="mt-6 bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-stone-400" />
                <span className="text-sm font-medium text-stone-600">Transcript</span>
              </div>
              {mode === "recording-speech" && (
                <div className="flex gap-0.5 items-end h-4">
                  {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-red-400 rounded-full animate-pulse"
                      style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              )}
              {mode === "recording-audio" && (
                <span className="text-xs text-stone-400 italic">transcribed after stop</span>
              )}
            </div>
            <div
              ref={scrollRef}
              className="p-5 max-h-56 overflow-y-auto text-sm text-stone-700 leading-relaxed font-sans"
            >
              {transcript}
              {interimText && <span className="text-stone-400 italic">{interimText}</span>}
              {!transcript && !interimText && mode === "recording-speech" && (
                <span className="text-stone-400 italic">Listening...</span>
              )}
              {!transcript && mode === "recording-audio" && (
                <span className="text-stone-400 italic">Recording in progress...</span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary results */}
        {summary && (
          <div className="mt-8 space-y-5">
            <h2
              className="text-2xl font-semibold text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {summary.title}
            </h2>

            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} className="text-stone-400" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  Meeting Summary
                </h3>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                {summary.summary}
              </p>
            </div>

            {summary.tasks.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare size={15} className="text-stone-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    Action Items
                  </h3>
                </div>
                <ul className="space-y-2">
                  {summary.tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-stone-700">
                      <span className="mt-0.5 w-5 h-5 rounded border border-stone-200 flex-shrink-0 flex items-center justify-center text-xs text-stone-400 font-medium">
                        {i + 1}
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {!sheetsLink ? (
                <button
                  onClick={handleSaveToSheets}
                  disabled={savingSheets}
                  className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSheets ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Saving to Sheets...
                    </>
                  ) : (
                    <>
                      <TableProperties size={15} />
                      Save to Google Sheets
                    </>
                  )}
                </button>
              ) : (
                <a
                  href={sheetsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ExternalLink size={15} />
                  Open in Google Sheets
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
