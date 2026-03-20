# Positive Vibes — Voice & Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-chat UI in the Positive Vibes page with a hands-free voice conversation experience centred on an animated point-cloud globe.

**Architecture:** Four changes in dependency order — (1) Globe canvas component, (2) streaming chat API, (3) save-transcript API + OAuth scope, (4) full page rewrite wiring everything together.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Web Speech API (`SpeechRecognition` + `SpeechSynthesis`), `@google/genai` streaming, Google Docs REST API, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-03-20-positive-vibes-voice-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `components/positive-vibes-globe.tsx` | Canvas point-cloud globe, driven by `state` + `audioLevel` props |
| Modify | `app/api/positive-vibes/chat/route.ts` | Switch `generateContent` → `generateContentStream`, return raw text stream |
| Modify | `lib/auth.ts` | Add `https://www.googleapis.com/auth/documents` OAuth scope |
| Create | `app/api/positive-vibes/save-transcript/route.ts` | Create Google Doc from transcript, return edit URL |
| Modify | `app/positive-vibes/page.tsx` | Full rewrite: voice input/output, globe, state machine, no text chat |

---

## Task 1: Globe Component

**Files:**
- Create: `components/positive-vibes-globe.tsx`

### Context

This is a self-contained Canvas 2D animation. It receives `state` and `audioLevel` props and renders a point-cloud sphere. No dependencies on other new files. No existing component to reference — write from scratch. `@types/dom-speech-recognition` is already installed so browser APIs type-check without extra imports.

The globe algorithm:
- 1400 Fibonacci-spiral points evenly distributed on unit sphere surface
- Each frame: rotate Y-axis, project 3D → 2D, sort back-to-front by depth, draw depth-scaled dots
- Ripple: layered sine-wave displacement on each point's radius, scaled by `ripple` (0–1)
- `ripple` target: `listening` → 0.28 constant, `speaking` → `smoothAudio × 0.85`, `idle/done` → 0
- `smoothAudio` lerps toward `audioLevel` each frame: `smoothAudio += (audioLevel - smoothAudio) * 0.08`

- [ ] **Step 1: Create the globe component**

```tsx
// components/positive-vibes-globe.tsx
"use client"

import { useEffect, useRef } from "react"

export type GlobeState = "idle" | "listening" | "speaking" | "done"

interface Props {
  state: GlobeState
  audioLevel: number // 0–1
  size?: number      // canvas px, default 300
}

function makePts(n: number) {
  const g = Math.PI * (3 - Math.sqrt(5))
  const pts: { ox: number; oy: number; oz: number }[] = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = g * i
    pts.push({ ox: Math.cos(th) * r, oy: y, oz: Math.sin(th) * r })
  }
  return pts
}

const PTS = makePts(1400)

export default function PositiveVibesGlobe({ state, audioLevel, size = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const audioRef = useRef(audioLevel)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { audioRef.current = audioLevel }, [audioLevel])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const CX = size / 2, CY = size / 2, R = size * 0.33

    let t = 0
    let ripple = 0
    let smoothAudio = 0
    let rafId = 0

    function displace(ox: number, oy: number, oz: number, rpl: number): number {
      if (rpl < 0.005) return 0
      return (
        Math.sin(t * 1.8 + oz * 2.8 + oy * 1.9) * 18 +
        Math.sin(t * 1.2 + ox * 1.8 - oy * 2.4) * 11 +
        Math.sin(t * 2.8 - oz * 3.8 + ox * 1.0) *  6 +
        Math.sin(t * 0.7 + ox * 5.5 + oy * 2.9) *  4
      ) * rpl
    }

    function draw() {
      const s = stateRef.current
      const al = audioRef.current

      // Smooth audio
      smoothAudio += (al - smoothAudio) * 0.08

      // Ripple target
      let targetRipple = 0
      if (s === "listening") targetRipple = 0.28
      else if (s === "speaking") targetRipple = smoothAudio * 0.85
      ripple += (targetRipple - ripple) * 0.06

      // Rotation speed
      const speeds: Record<GlobeState, number> = { idle: 0.006, listening: 0.010, speaking: 0.014, done: 0.005 }
      t += speeds[s]

      ctx.clearRect(0, 0, size, size)

      // Background glow
      const [glowR, glowG, glowB] =
        s === "listening" ? [60, 150, 230] :
        s === "speaking"  ? [200, 160, 20] :
        [55, 195, 110]
      const gAmt = 0.03 + ripple * 0.15
      const bg = ctx.createRadialGradient(CX, CY, 10, CX, CY, R + 70)
      bg.addColorStop(0,   `rgba(${glowR},${glowG},${glowB},${gAmt})`)
      bg.addColorStop(0.6, `rgba(${glowR},${glowG},${glowB},${gAmt * 0.3})`)
      bg.addColorStop(1,   "rgba(0,0,0,0)")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, size, size)

      const rotY = t * 0.18
      const cosR = Math.cos(rotY), sinR = Math.sin(rotY)

      const projected = PTS.map(p => {
        const disp = displace(p.ox, p.oy, p.oz, ripple)
        const r = R + disp
        const x0 = p.ox * r, y0 = p.oy * r, z0 = p.oz * r
        const x = x0 * cosR + z0 * sinR
        const z = -x0 * sinR + z0 * cosR
        const depth = (z + R + 20) / (2 * R + 20)
        return { sx: CX + x, sy: CY - y0, depth }
      }).sort((a, b) => a.depth - b.depth)

      projected.forEach(p => {
        if (p.depth < 0.02) return
        const dotSize = 0.15 + p.depth * 0.75
        let rr: number, gg: number, bb: number

        if (s === "listening") {
          rr = Math.round(20  + p.depth * 60)
          gg = Math.round(110 + p.depth * 100)
          bb = Math.round(180 + p.depth * 60)
        } else if (s === "speaking") {
          rr = Math.round(200 + p.depth * 55)
          gg = Math.round(160 + p.depth * 60)
          bb = Math.round(20  + p.depth * 30)
        } else {
          // idle / done — green
          const blend = Math.max(0, Math.min(1, (p.sy - CY * 0.4) / (CY * 1.33)))
          rr = Math.round(25  + blend * 45  + p.depth * 105)
          gg = Math.round(160 - blend * 30  + p.depth * 80)
          bb = Math.round(90  + blend * 12  + p.depth * 50)
        }

        const alpha = 0.10 + p.depth * 0.90
        if (p.depth > 0.80 && ripple > 0.12) {
          ctx.shadowBlur = 3 + ripple * 7
          ctx.shadowColor = s === "listening"
            ? "rgba(80,180,255,0.7)"
            : s === "speaking"
            ? "rgba(255,220,60,0.7)"
            : "rgba(80,240,150,0.7)"
        } else {
          ctx.shadowBlur = 0
        }

        ctx.beginPath()
        ctx.arc(p.sx, p.sy, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha})`
        ctx.fill()
      })

      ctx.shadowBlur = 0

      // Floating particles when active
      if (ripple > 0.12) {
        for (let k = 0; k < 32; k++) {
          const angle = (k / 32) * Math.PI * 2 + t * 0.25 * (k % 2 === 0 ? 1 : -0.6)
          const elev = Math.sin(k * 1.3 + t * 0.4) * 0.55
          const dist = R + 6 + Math.sin(k * 1.9 + t * 1.1) * 15
          const px = CX + Math.cos(angle) * dist * Math.cos(elev)
          const py = CY - Math.sin(elev) * dist
          const pa = ripple * (0.14 + Math.sin(k + t * 2) * 0.08)
          const ps = Math.max(0.2, 0.6 + Math.sin(k * 1.5 + t) * 0.4)
          ctx.beginPath()
          ctx.arc(px, py, ps, 0, Math.PI * 2)
          ctx.fillStyle = s === "listening"
            ? `rgba(100,190,255,${pa})`
            : s === "speaking"
            ? `rgba(255,210,80,${pa})`
            : `rgba(110,235,165,${pa})`
          ctx.fill()
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [size]) // only re-mount if size changes; state/audioLevel come via refs

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/positive-vibes-globe.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/positive-vibes-globe.tsx
git commit -m "feat: add PositiveVibesGlobe canvas component"
```

---

## Task 2: Streaming Chat API Route

**Files:**
- Modify: `app/api/positive-vibes/chat/route.ts`

### Context

The existing route uses `ai.models.generateContent` (non-streaming) and returns `{ reply: string }`. We need to switch to `ai.models.generateContentStream` and return a raw `ReadableStream` of text chunks. The client will read it with `response.body.getReader()`.

Keep all existing auth guard, validation, and error handling. Only the Gemini call and response change.

Current route is at `app/api/positive-vibes/chat/route.ts` — read it before editing.

- [ ] **Step 1: Replace the Gemini call and response**

Replace the block from `const response = await ai.models.generateContent(` through `return NextResponse.json({ reply })` with:

```typescript
const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  config: { systemInstruction: COACH_PERSONA },
  contents,
})

const readable = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder()
    try {
      for await (const chunk of stream) {
        const text = chunk.text ?? ""
        if (text) controller.enqueue(encoder.encode(text))
      }
    } finally {
      controller.close()
    }
  },
})

return new Response(readable, {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
})
```

The full updated file should look like:

```typescript
// app/api/positive-vibes/chat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { auth } from "@/lib/auth"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const COACH_PERSONA = `You are a warm, mindful coach. Your role is to listen, encourage, and help the user gently reframe negative thinking. You do not give advice unless asked. You reflect back what you hear, ask gentle clarifying questions, and hold space for the user's feelings. Your tone is calm, grounded, and compassionate — like a trusted friend who also happens to have deep wisdom. Never be dismissive. Never rush to fix. Let the user feel heard first.

Begin each conversation by acknowledging the quote of the day if the user references it, but do not force it.`

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let messages: unknown
    try {
      const body = await request.json()
      messages = body?.messages
    } catch {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    const isValidMessage = (m: unknown): m is { role: "user" | "model"; content: string } =>
      typeof m === "object" &&
      m !== null &&
      ((m as { role: unknown }).role === "user" || (m as { role: unknown }).role === "model") &&
      typeof (m as { content: unknown }).content === "string"

    if (!messages.every(isValidMessage)) {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    const contents = messages.map((m: { role: "user" | "model"; content: string }) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: { systemInstruction: COACH_PERSONA },
      contents,
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.text ?? ""
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (err: unknown) {
    console.error("Positive Vibes chat error:", err)
    const message = err instanceof Error ? err.message : "Something went wrong"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/api/positive-vibes/chat/route.ts
git commit -m "feat: switch positive-vibes chat route to streaming"
```

---

## Task 3: OAuth Scope + Save-Transcript API Route

**Files:**
- Modify: `lib/auth.ts`
- Create: `app/api/positive-vibes/save-transcript/route.ts`

### Context

`lib/auth.ts` already has `drive.file` and `spreadsheets` scopes. Add `documents` to the same space-separated string. No other changes to auth.

The save-transcript route calls the Google Docs REST API directly (no SDK needed — just `fetch`). It:
1. Creates a new blank Doc titled `"Positive Vibes — <date>"`
2. Inserts formatted transcript text using the `batchUpdate` endpoint
3. Returns `{ url }` pointing to the Google Docs edit URL

Google Docs API reference:
- Create: `POST https://docs.googleapis.com/v1/documents` body: `{ title }`
- Batch update: `POST https://docs.googleapis.com/v1/documents/{documentId}:batchUpdate` body: `{ requests: [{ insertText: { location: { index: 1 }, text } }] }`
- Edit URL: `https://docs.google.com/document/d/{documentId}/edit`

The `accessToken` comes from `session.accessToken` (already typed in existing routes).

- [ ] **Step 1: Add `documents` scope to `lib/auth.ts`**

Find the scope string in `lib/auth.ts`:
```
"openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets"
```

Replace with:
```
"openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents"
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Create the save-transcript route**

```typescript
// app/api/positive-vibes/save-transcript/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

interface Message {
  role: "user" | "model"
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const transcript: Message[] = body?.transcript ?? []

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: "transcript is empty" }, { status: 400 })
    }

    const token = session.accessToken as string
    const dateStr = new Date().toLocaleDateString("en-SG", {
      day: "numeric", month: "long", year: "numeric",
    })
    const title = `Positive Vibes — ${dateStr}`

    // 1. Create blank doc
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error("Docs create error:", err)
      return NextResponse.json({ error: "Failed to create Google Doc" }, { status: 502 })
    }

    const doc = await createRes.json()
    const documentId: string = doc.documentId

    // 2. Build transcript text
    const lines = transcript
      .map(m => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`)
      .join("\n\n")

    // 3. Insert text via batchUpdate
    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ insertText: { location: { index: 1 }, text: lines } }],
        }),
      }
    )

    if (!updateRes.ok) {
      const err = await updateRes.text()
      console.error("Docs batchUpdate error:", err)
      return NextResponse.json({ error: "Failed to write transcript" }, { status: 502 })
    }

    const url = `https://docs.google.com/document/d/${documentId}/edit`
    return NextResponse.json({ url })
  } catch (err: unknown) {
    console.error("Save transcript error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/api/positive-vibes/save-transcript/route.ts
git commit -m "feat: add save-transcript route and Google Docs OAuth scope"
```

---

## Task 4: Positive Vibes Page Rewrite

**Files:**
- Modify: `app/positive-vibes/page.tsx`

### Context

Full replacement of the existing text-chat page. Read the current file before editing — the header and quote banner markup can be reused verbatim, only the body changes.

Key patterns:
- `SpeechRecognition` is browser-only — check `typeof window !== "undefined"` and `"SpeechRecognition" in window || "webkitSpeechRecognition" in window` before instantiating
- `SpeechSynthesis`: use `window.speechSynthesis`; call `cancel()` before queuing new utterances to avoid stacking
- Streaming: `response.body.getReader()` + `TextDecoder`; accumulate into `sentenceBuffer`; extract all sentence-boundary spans in one pass per chunk using `extractSentences()`; flush remainder when stream ends
- `audioLevel` state: set to `1` on utterance `onstart`, `0` on utterance `onend`
- Auto-loop: in each utterance's `onend`, if `utteranceQueueRef.current === 0 && streamDoneRef.current && stateRef.current !== "done"`, call `startListeningRef.current()`
- After stream is fully read: set `streamDoneRef.current = true`; if `utteranceQueueRef.current === 0` at that moment (all utterances already finished), trigger auto-loop immediately
- AbortController: cancel in-flight fetch on unmount and on new request
- Fresh `SpeechRecognition` instance each call to `startListening` (some browsers disallow `start()` on a used instance)
- `stateRef` mirrors `state` so async callbacks always see current value
- `submitUserMessageRef` and `startListeningRef` are kept up-to-date via `useEffect` to avoid stale-closure bugs across `useCallback` boundaries
- TypeScript cast for `SpeechRecognition`: use `(window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })`

Voice settings: `utterance.rate = 0.95`, `utterance.pitch = 1.0`; prefer first voice where `lang.startsWith("en")`.

- [ ] **Step 1: Write the new page**

```tsx
// app/positive-vibes/page.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import PositiveVibesGlobe, { type GlobeState } from "@/components/positive-vibes-globe"

type WinWithSR = typeof window & {
  SpeechRecognition?: typeof SpeechRecognition
  webkitSpeechRecognition?: typeof SpeechRecognition
}

interface Message {
  role: "user" | "model"
  content: string
}

interface Quote {
  q: string
  a: string
}

const FALLBACK_QUOTE: Quote = { q: "Breathe. This too shall pass.", a: "Unknown" }

function getStoredQuote(): Quote {
  if (typeof window === "undefined") return FALLBACK_QUOTE
  try {
    const quotes = JSON.parse(localStorage.getItem("positive_vibes_quotes") ?? "[]") as Quote[]
    const index = parseInt(localStorage.getItem("positive_vibes_index") ?? "0", 10)
    return quotes[isNaN(index) ? 0 : index] ?? FALLBACK_QUOTE
  } catch {
    return FALLBACK_QUOTE
  }
}

// Extract complete sentences from buffer; returns sentences array + unconsumed remainder
function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = []
  const boundary = /[.!?](?=\s|$)/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  while ((match = boundary.exec(buffer)) !== null) {
    sentences.push(buffer.slice(lastIndex, match.index + 1))
    lastIndex = match.index + 1
  }
  return { sentences, remainder: buffer.slice(lastIndex) }
}

const STATE_LABELS: Record<GlobeState, string> = {
  idle: "Tap the mic to begin",
  listening: "Listening...",
  speaking: "Speaking...",
  done: "Conversation complete",
}

export default function PositiveVibesPage() {
  const [globeState, setGlobeState] = useState<GlobeState>("idle")
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote>(FALLBACK_QUOTE)
  const [saving, setSaving] = useState(false)

  const stateRef = useRef<GlobeState>("idle")
  const messagesRef = useRef<Message[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamDoneRef = useRef(false)
  const utteranceQueueRef = useRef(0)
  // Stable refs to latest callbacks — avoids stale closures across useCallback boundaries
  const startListeningRef = useRef<() => void>(() => {})
  const submitUserMessageRef = useRef<(t: string) => void>(() => {})

  function setState(s: GlobeState) {
    stateRef.current = s
    setGlobeState(s)
  }

  useEffect(() => { setQuote(getStoredQuote()) }, [])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  // speakText: enqueues an utterance; auto-loop fires from onend when queue hits 0 + stream done
  const speakText = useCallback((text: string) => {
    if (!text.trim() || typeof window === "undefined") return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find(v => v.lang.startsWith("en"))
    if (enVoice) utterance.voice = enVoice

    utterance.onstart = () => setAudioLevel(1)
    utterance.onend = () => {
      setAudioLevel(0)
      utteranceQueueRef.current = Math.max(0, utteranceQueueRef.current - 1)
      // Auto-loop: all utterances done + stream fully read + not ended by user
      if (utteranceQueueRef.current === 0 && streamDoneRef.current && stateRef.current !== "done") {
        startListeningRef.current()
      }
    }
    utterance.onerror = () => {
      setAudioLevel(0)
      utteranceQueueRef.current = Math.max(0, utteranceQueueRef.current - 1)
    }

    utteranceQueueRef.current++
    window.speechSynthesis.speak(utterance)
  }, [])

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return
    const win = window as WinWithSR
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition
    if (!SR) {
      setError("Voice not supported in this browser (Chrome/Edge only)")
      return
    }

    setState("listening")
    setError(null)

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ""
      if (!transcript) { setState("idle"); return }
      submitUserMessageRef.current(transcript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return
      if (event.error === "not-allowed") {
        setError("Mic access denied — check browser settings")
      } else if (event.error === "network") {
        setError("Network error during recognition — try again")
      } else {
        setError(`Recognition error: ${event.error}`)
      }
      setState("idle")
    }

    recognition.onend = () => {
      if (stateRef.current === "listening") setState("idle")
    }

    recognition.start()
  }, [])

  // Keep refs current
  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const submitUserMessage = useCallback((transcript: string) => {
    const userMessage: Message = { role: "user", content: transcript }
    const updatedMessages = [...messagesRef.current, userMessage]
    messagesRef.current = updatedMessages

    setState("speaking")
    setError(null)
    streamDoneRef.current = false
    utteranceQueueRef.current = 0
    window.speechSynthesis?.cancel()

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    ;(async () => {
      try {
        const res = await fetch("/api/positive-vibes/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updatedMessages }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => ({ error: "Could not reach the coach" }))
          throw new Error(errData.error ?? "Could not reach the coach")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let sentenceBuffer = ""
        let fullReply = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sentenceBuffer += decoder.decode(value, { stream: true })

          const { sentences, remainder } = extractSentences(sentenceBuffer)
          sentenceBuffer = remainder
          for (const s of sentences) {
            const text = s.trim()
            if (text) {
              fullReply += (fullReply ? " " : "") + text
              speakText(text)
            }
          }
        }

        // Flush any remaining text that didn't end with punctuation
        const remaining = sentenceBuffer.trim()
        if (remaining) {
          fullReply += (fullReply ? " " : "") + remaining
          speakText(remaining)
        }

        streamDoneRef.current = true

        if (fullReply) {
          messagesRef.current = [...messagesRef.current, { role: "model", content: fullReply }]
        }

        // Safety net: if all utterances already finished before we set streamDoneRef
        if (utteranceQueueRef.current === 0 && stateRef.current !== "done") {
          startListeningRef.current()
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Something went wrong")
        setState("idle")
      }
    })()
  }, [speakText])

  useEffect(() => { submitUserMessageRef.current = submitUserMessage }, [submitUserMessage])

  const handleMicClick = () => {
    if (globeState === "listening") {
      setState("idle")
    } else if (globeState === "speaking") {
      abortControllerRef.current?.abort()
      window.speechSynthesis?.cancel()
      streamDoneRef.current = true
      utteranceQueueRef.current = 0
      setAudioLevel(0)
      startListening()
    } else {
      // idle or done
      startListening()
    }
  }

  const handleEnd = () => {
    abortControllerRef.current?.abort()
    window.speechSynthesis?.cancel()
    utteranceQueueRef.current = 0
    setAudioLevel(0)
    setState("done")
  }

  const handleSave = async () => {
    if (messagesRef.current.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/positive-vibes/save-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: messagesRef.current }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't save")
      window.open(data.url, "_blank", "noopener")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again")
    } finally {
      setSaving(false)
    }
  }

  // Gate behind useEffect to avoid SSR/hydration mismatch
  const [voiceSupported, setVoiceSupported] = useState(false)
  useEffect(() => {
    setVoiceSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  }, [])

  return (
    <div className="flex flex-col h-screen" style={{ background: "#f2f6f2" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 py-4 border-b shrink-0"
        style={{
          background: "linear-gradient(to right, #edf4ed, #f8fbf8)",
          borderColor: "#e4efe4",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "#b0c8b0" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#4a7c59")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#b0c8b0")}
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span style={{ color: "#d8e8d8" }}>|</span>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "#4a7c59" }} />
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "#2d5a3d", fontFamily: "var(--font-display)" }}
          >
            Positive Vibes
          </span>
        </div>
        <span
          className="ml-auto text-xs italic hidden sm:block"
          style={{ color: "#b0c8b0" }}
        >
          You&apos;re not alone in this.
        </span>
      </header>

      {/* Quote banner */}
      <div
        className="shrink-0 px-6 py-3 text-center text-sm italic border-b"
        style={{ background: "#f2f6f2", borderColor: "#d4e8d4", color: "#4a7c59" }}
      >
        ✦ &ldquo;{quote.q}&rdquo; — {quote.a}
      </div>

      {/* Main area */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6"
        style={{ background: "#0d1a14" }}
      >
        {/* Globe */}
        <PositiveVibesGlobe state={globeState} audioLevel={audioLevel} size={300} />

        {/* State label */}
        <p className="text-sm italic" style={{ color: "#6abf88", letterSpacing: "0.04em", minHeight: "20px" }}>
          {STATE_LABELS[globeState]}
        </p>

        {/* Error */}
        {error && (
          <p className="text-xs italic" style={{ color: "#f5a623", maxWidth: "280px", textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Mic button */}
          {voiceSupported ? (
            <button
              onClick={handleMicClick}
              aria-label={globeState === "listening" ? "Stop listening" : "Start listening"}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: 56, height: 56,
                background: "#0f2a1a",
                border: `2px solid ${globeState === "listening" ? "#3a6a9a" : "#3a8a5a"}`,
                fontSize: 22,
                animation: globeState === "listening" ? "pulseMic 1.2s infinite" : "none",
                boxShadow: globeState === "listening"
                  ? "0 0 0 6px rgba(74,140,200,0.2), 0 0 0 14px rgba(74,140,200,0.07)"
                  : "none",
              }}
            >
              🎙
            </button>
          ) : (
            <p className="text-xs" style={{ color: "#6abf88" }}>
              Voice not supported in this browser
            </p>
          )}

          {/* End button */}
          <button
            onClick={handleEnd}
            className="text-xs rounded-full px-4 py-1.5 transition-colors"
            style={{ border: "1px solid #2a5a3a", color: "#5abf80", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0f2a1a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            End
          </button>
        </div>

        {/* Save to Google Docs */}
        {globeState === "done" && messagesRef.current.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs rounded-full px-5 py-2 transition-opacity disabled:opacity-50"
            style={{ border: "1px solid #2a5a3a", color: "#5abf80", background: "transparent" }}
          >
            {saving ? "Saving..." : "📄 Save to Google Docs"}
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulseMic {
          0%, 100% { box-shadow: 0 0 0 6px rgba(74,140,200,0.2), 0 0 0 14px rgba(74,140,200,0.07); }
          50%       { box-shadow: 0 0 0 10px rgba(74,140,200,0.15), 0 0 0 20px rgba(74,140,200,0.04); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: build succeeds with no errors (warnings about `useCallback` dependency arrays are acceptable)

- [ ] **Step 4: Commit**

```bash
git add app/positive-vibes/page.tsx
git commit -m "feat: rewrite positive-vibes page with voice conversation and globe"
```

---

## Task 5: Manual Verification

**Files:** None

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Navigate to `http://localhost:3000`, sign in, open Positive Vibes.

- [ ] **Step 2: Verify idle state**

Expected: Dark background, green rotating globe, "Tap the mic to begin" label, mic button and End button visible.

- [ ] **Step 3: Verify listening state**

Click mic. Expected:
- Globe turns blue with gentle sway
- Label shows "Listening..."
- Mic button border turns blue with pulse animation
- Speak something; globe transitions to speaking after recognition

- [ ] **Step 4: Verify speaking state**

Expected:
- Globe turns yellow
- Globe ripples when AI is talking, goes calm during silence between sentences
- Label shows "Speaking..."
- After AI finishes, mic auto-reactivates (globe turns blue again)

- [ ] **Step 5: Verify End → Save flow**

Click End at any point. Expected:
- Globe returns to green (done)
- Label: "Conversation complete"
- "Save to Google Docs" button appears
- Click Save → new Google Doc opens in a new tab with speaker-labelled transcript

- [ ] **Step 6: Verify error handling**

In a browser where mic is blocked: expected "Mic access denied" error text in amber below the globe, not a crash.

- [ ] **Step 7: Deploy to Vercel**

Run: `git push origin master`
Verify Vercel deployment succeeds and the feature works in production (note: users will need to re-authorise OAuth to grant the new `documents` scope on next sign-in).
