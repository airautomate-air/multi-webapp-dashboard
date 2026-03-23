// app/site-recce/components/VoiceNote.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, Square, Loader2 } from "lucide-react"

interface VoiceNoteProps {
  field: string           // e.g. "landNotes" — sent to API so it knows which field
  onTranscript: (text: string) => void
}

type State = "idle" | "recording" | "transcribing" | "error"

export default function VoiceNote({ field, onTranscript }: VoiceNoteProps) {
  const [state, setState] = useState<State>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function startRecording() {
    setErrorMsg("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => transcribe(streamRef.current!)
      recorderRef.current = recorder
      recorder.start()
      setState("recording")
    } catch {
      setErrorMsg("Microphone access denied")
      setState("error")
    }
  }

  function stopRecording() {
    if (!recorderRef.current) return
    recorderRef.current.stop()
    setState("transcribing")
  }

  async function transcribe(stream: MediaStream) {
    stream.getTracks().forEach(t => t.stop())
    const blob = new Blob(chunksRef.current, { type: "audio/webm" })
    const fd = new FormData()
    fd.append("audio", blob)
    fd.append("field", field)
    try {
      const res = await fetch("/api/site-recce/transcribe", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onTranscript(data.text)
      setState("idle")
    } catch (err) {
      console.error("[VoiceNote] transcription error:", err)
      setErrorMsg("Transcription failed. Try again.")
      setState("error")
    }
  }

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      {state === "idle" || state === "error" ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg transition-colors"
        >
          <Mic size={14} /> Record voice note
        </button>
      ) : state === "recording" ? (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition-colors animate-pulse"
        >
          <Square size={14} /> Stop recording
        </button>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-stone-500 px-3 py-2">
          <Loader2 size={14} className="animate-spin" /> Transcribing...
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
    </div>
  )
}
