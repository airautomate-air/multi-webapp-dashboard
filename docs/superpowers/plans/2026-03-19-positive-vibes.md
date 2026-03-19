# Positive Vibes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Positive Vibes tool with a live hourly quote on the dashboard card (ZenQuotes, free) and a full-screen mindful coach chat powered by Gemini.

**Architecture:** Two API routes handle data — a ZenQuotes proxy for quotes (no auth) and a Gemini chat route (auth required). A `QuoteDisplay` client component encapsulates all localStorage caching and hourly rotation logic. The `AppGrid` component gains a `renderContent` escape hatch so the Positive Vibes card can render the live quote instead of a static description. The conversation page follows the same pattern as the Mentor page.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `@google/genai` (already installed), `lucide-react`, ZenQuotes public API

---

## Codebase Notes

- `components/ui/spotlight-card.tsx` already has `"green"` in the `glowColor` type union and `glowColorMap` with `{ base: 120, spread: 200 }`. The spec requires `{ base: 140, spread: 150 }` — Task 4 includes a step to update these values.
- `components/app-grid.tsx` is `"use client"` — `QuoteDisplay` can be embedded directly without server component conflicts.
- All Gemini API calls follow the pattern in `app/api/mentor/route.ts`: `ai.models.generateContent({ model, config: { systemInstruction }, contents })`.
- Auth pattern: `const session = await auth()` / `if (!session?.accessToken) return 401`.
- No test runner — use `npm run build` for TypeScript verification and manual browser testing.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/api/positive-vibes/quotes/route.ts` | GET — ZenQuotes proxy, no auth |
| Create | `app/api/positive-vibes/chat/route.ts` | POST — Gemini mindful coach chat, auth required |
| Create | `components/quote-display.tsx` | Client component: quote fetch, localStorage cache, hourly rotation |
| Modify | `components/app-grid.tsx` | Add `renderContent` support + Positive Vibes card entry |
| Modify | `components/ui/spotlight-card.tsx` | Update green glow values to match spec |
| Create | `app/positive-vibes/page.tsx` | Full-screen mindful coach chat UI |

---

## Task 1: Quote API route — GET /api/positive-vibes/quotes

**Files:**
- Create: `app/api/positive-vibes/quotes/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/positive-vibes/quotes/route.ts
import { NextResponse } from "next/server"

const ZENQUOTES_URL = "https://zenquotes.io/api/quotes"

const FALLBACK_QUOTES = [
  { q: "Breathe. This too shall pass.", a: "Unknown" },
  { q: "You are enough, exactly as you are.", a: "Unknown" },
  { q: "The present moment always will have been.", a: "Marcus Aurelius" },
]

export async function GET() {
  try {
    const res = await fetch(ZENQUOTES_URL, {
      next: { revalidate: 3600 }, // Next.js cache: revalidate every hour
    })

    if (!res.ok) {
      return NextResponse.json(FALLBACK_QUOTES)
    }

    const data = await res.json()

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(FALLBACK_QUOTES)
    }

    // Filter to valid Quote objects only
    const quotes = data.filter(
      (item: unknown): item is { q: string; a: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { q: unknown }).q === "string" &&
        typeof (item as { a: unknown }).a === "string"
    )

    return NextResponse.json(quotes.length > 0 ? quotes : FALLBACK_QUOTES)
  } catch {
    return NextResponse.json(FALLBACK_QUOTES)
  }
}
```

Note: No auth on this route — it proxies public data and exposes no API keys.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/jcgco/Desktop/Julius/Claude/multi-webapp-dashboard"
npm run build 2>&1 | tail -15
```

Expected: No new errors. `/api/positive-vibes/quotes` appears in route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/positive-vibes/quotes/route.ts
git commit -m "feat: add GET /api/positive-vibes/quotes route"
```

---

## Task 2: Chat API route — POST /api/positive-vibes/chat

**Files:**
- Create: `app/api/positive-vibes/chat/route.ts`

- [ ] **Step 1: Create the file**

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

    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 })
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { systemInstruction: COACH_PERSONA },
      contents,
    })

    const reply = response.text ?? ""
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    console.error("Positive Vibes chat error:", err)
    const message = err instanceof Error ? err.message : "Something went wrong"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -15
```

Expected: No new errors. `/api/positive-vibes/chat` appears in route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/positive-vibes/chat/route.ts
git commit -m "feat: add POST /api/positive-vibes/chat route"
```

---

## Task 3: QuoteDisplay component

**Files:**
- Create: `components/quote-display.tsx`

This is the client component used inside the dashboard card. It handles all quote fetching, localStorage caching, and hourly rotation. It renders the quote content only (no card shell — that's handled by AppGrid).

- [ ] **Step 1: Create the file**

```typescript
// components/quote-display.tsx
"use client"

import { useState, useEffect } from "react"

interface Quote {
  q: string
  a: string
}

const FALLBACK: Quote = { q: "Breathe. This too shall pass.", a: "Unknown" }

const STORAGE_KEYS = {
  quotes: "positive_vibes_quotes",
  fetchedAt: "positive_vibes_fetched_at",
  index: "positive_vibes_index",
  lastRotated: "positive_vibes_last_rotated",
}

function readStorage(): {
  quotes: Quote[]
  fetchedAt: string | null
  index: number
  lastRotated: string | null
} {
  try {
    const quotes = JSON.parse(localStorage.getItem(STORAGE_KEYS.quotes) ?? "[]") as Quote[]
    const fetchedAt = localStorage.getItem(STORAGE_KEYS.fetchedAt)
    const index = parseInt(localStorage.getItem(STORAGE_KEYS.index) ?? "0", 10)
    const lastRotated = localStorage.getItem(STORAGE_KEYS.lastRotated)
    return { quotes: Array.isArray(quotes) ? quotes : [], fetchedAt, index, lastRotated }
  } catch {
    return { quotes: [], fetchedAt: null, index: 0, lastRotated: null }
  }
}

function writeStorage(quotes: Quote[], index: number) {
  try {
    localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes))
    localStorage.setItem(STORAGE_KEYS.index, String(index))
    localStorage.setItem(STORAGE_KEYS.lastRotated, new Date().toISOString())
  } catch {
    // Ignore storage errors
  }
}

async function fetchQuotes(): Promise<Quote[]> {
  try {
    const res = await fetch("/api/positive-vibes/quotes")
    if (!res.ok) return [FALLBACK]
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.fetchedAt, new Date().toISOString())
      return data as Quote[]
    }
    return [FALLBACK]
  } catch {
    return [FALLBACK]
  }
}

export default function QuoteDisplay() {
  const [quote, setQuote] = useState<Quote>(FALLBACK)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadQuote() {
      let { quotes, fetchedAt, index, lastRotated } = readStorage()

      const now = new Date()
      const hourMs = 60 * 60 * 1000
      const dayMs = 24 * hourMs

      // Rotate if more than 1 hour has passed
      const needsRotation =
        !lastRotated || now.getTime() - new Date(lastRotated).getTime() > hourMs

      if (needsRotation) {
        index = index + 1
      }

      // Fetch new batch if exhausted, empty, or >24h old
      const batchExpired =
        !fetchedAt || now.getTime() - new Date(fetchedAt).getTime() > dayMs

      if (index >= quotes.length || quotes.length === 0 || batchExpired) {
        quotes = await fetchQuotes()
        index = 0
      }

      writeStorage(quotes, index)
      setQuote(quotes[index] ?? FALLBACK)
      setLoaded(true)
    }

    loadQuote()
  }, [])

  if (!loaded) {
    return (
      <div className="flex flex-col h-full justify-between">
        <div className="p-1">
          <div className="w-10 h-10 rounded-xl bg-white/60 border border-stone-200 flex items-center justify-center mb-4 shadow-sm">
            <span className="text-lg">✨</span>
          </div>
          <div className="h-3 bg-stone-200/60 rounded animate-pulse mb-2 w-3/4" />
          <div className="h-3 bg-stone-200/60 rounded animate-pulse mb-2 w-full" />
          <div className="h-3 bg-stone-200/60 rounded animate-pulse w-1/2" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[#4a7c59]">Positive Vibes</span>
          <span className="text-stone-400">↻ hourly</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full justify-between relative z-10">
      <div className="p-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-sm"
          style={{ background: "linear-gradient(135deg, #c8d8c8, #e8f0e8)", border: "1px solid #b8ccb8" }}>
          <span className="text-lg">✨</span>
        </div>
        <p
          className="text-sm italic leading-relaxed mb-2 line-clamp-3"
          style={{ color: "#444" }}
        >
          &ldquo;{quote.q}&rdquo;
        </p>
        <p className="text-xs text-stone-400">— {quote.a}</p>
      </div>
      <div className="flex items-center justify-between text-xs font-medium">
        <span style={{ color: "#4a7c59" }}>Positive Vibes</span>
        <span style={{ color: "#b0c8b0" }}>↻ hourly</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -15
```

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add components/quote-display.tsx
git commit -m "feat: add QuoteDisplay component with localStorage caching"
```

---

## Task 4: Update AppGrid and spotlight-card — add Positive Vibes card

**Files:**
- Modify: `components/app-grid.tsx`
- Modify: `components/ui/spotlight-card.tsx`

The current `apps` array has items with `href`, `icon`, `title`, `description`, and `glowColor`. We need to add an optional `renderContent` field that, when present, replaces the description `<p>` with a custom node.

- [ ] **Step 1: Update green glow values in `components/ui/spotlight-card.tsx`**

Find this line:
```typescript
  green: { base: 120, spread: 200 },
```
Replace with:
```typescript
  green: { base: 140, spread: 150 },
```

- [ ] **Step 2: Update `components/app-grid.tsx`**

Make these exact changes:

1. Add `Sparkles` to the lucide-react import:
```typescript
import { FileText, BookOpen, Mic, Wand2, Brain, Sparkles } from "lucide-react"
```

2. Add `QuoteDisplay` import after the Link import:
```typescript
import QuoteDisplay from "@/components/quote-display"
```

3. Update the `apps` array type and entries. Change the array from an implicit type to an explicit typed array, and add `renderContent`:

Replace the line:
```typescript
const apps = [
```
with:
```typescript
interface App {
  href: string
  icon: React.ElementType
  title: string
  description: string
  glowColor: "blue" | "purple" | "green" | "red" | "orange"
  renderContent?: () => React.ReactNode
}

const apps: App[] = [
```

4. Add React import at the top (needed for `React.ElementType` and `React.ReactNode`):
```typescript
import React from "react"
```

5. Add the Positive Vibes entry at the end of the `apps` array:
```typescript
{
  href: "/positive-vibes",
  icon: Sparkles,
  title: "Positive Vibes",
  description: "Your daily dose of calm and inspiration.",
  glowColor: "green" as const,
  renderContent: () => <QuoteDisplay />,
},
```

6. Inside the `GlowCard` JSX, replace the description `<p>` rendering. Find this block:
```typescript
              <h2
                className="text-2xl font-semibold text-stone-900 mb-2 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {app.title}
              </h2>
              <p className="text-sm text-stone-500 leading-relaxed">
                {app.description}
              </p>
```
Replace with:
```typescript
              <h2
                className="text-2xl font-semibold text-stone-900 mb-2 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {app.title}
              </h2>
              {app.renderContent ? (
                app.renderContent()
              ) : (
                <p className="text-sm text-stone-500 leading-relaxed">
                  {app.description}
                </p>
              )}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -15
```

Expected: No new errors. `/positive-vibes` appears in static routes list.

- [ ] **Step 4: Commit**

```bash
git add components/app-grid.tsx components/quote-display.tsx components/ui/spotlight-card.tsx
git commit -m "feat: add Positive Vibes card to app grid with live quote"
```

---

## Task 5: Positive Vibes conversation page

**Files:**
- Create: `app/positive-vibes/page.tsx`

Full-screen mindful coach chat. Sage green theme. Session is fresh on each page load. Current quote shown as banner at top.

- [ ] **Step 1: Create `app/positive-vibes/page.tsx`**

```typescript
// app/positive-vibes/page.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Sparkles } from "lucide-react"

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
    return quotes[index] ?? FALLBACK_QUOTE
  } catch {
    return FALLBACK_QUOTE
  }
}

export default function PositiveVibesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote>(FALLBACK_QUOTE)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setQuote(getStoredQuote())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const charCount = input.length
  const overLimit = charCount > 1000
  const nearLimit = charCount >= 900

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || loading || overLimit) return

    const userMessage: Message = { role: "user", content: text }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput("")
    setLoading(true)
    setError(null)

    if (textareaRef.current) textareaRef.current.style.height = "auto"

    try {
      const res = await fetch("/api/positive-vibes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not reach the coach right now")

      const modelMessage: Message = { role: "model", content: data.reply }
      setMessages([...updatedMessages, modelMessage])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

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
        style={{
          background: "#f2f6f2",
          borderColor: "#d4e8d4",
          color: "#4a7c59",
        }}
      >
        ✦ &ldquo;{quote.q}&rdquo; — {quote.a}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm" style={{ color: "#b0c8b0" }}>
              Share what&apos;s on your mind. This is a safe space.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="max-w-2xl mx-auto">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[72%] px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: "#4a7c59",
                    color: "#fff",
                    borderRadius: "12px 12px 2px 12px",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div
                  className="max-w-[82%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: "#f2f6f2",
                    border: "1px solid #c8d8c8",
                    borderRadius: "0 12px 12px 12px",
                    color: "#444",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="max-w-2xl mx-auto flex justify-start">
            <div
              className="px-4 py-3"
              style={{
                background: "#ffffff",
                border: "1px solid #c8d8c8",
                borderRadius: "0 12px 12px 12px",
              }}
            >
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: "#b0c8b0", animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto flex justify-start">
            <div
              className="max-w-[82%] px-4 py-3 text-sm"
              style={{
                background: "#fff8f0",
                border: "1px solid #f5c6a0",
                borderRadius: "0 12px 12px 12px",
                color: "#c47c2a",
              }}
            >
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-3 border-t"
        style={{ background: "#fafcfa", borderColor: "#e4efe4" }}
      >
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind..."
            rows={1}
            className="flex-1 resize-none text-sm leading-relaxed outline-none transition-colors"
            style={{
              background: "#f2f6f2",
              border: `1px solid ${overLimit ? "#f5a623" : "#c8d8c8"}`,
              borderRadius: "10px",
              padding: "10px 14px",
              color: "#444",
              minHeight: "42px",
              maxHeight: "160px",
            }}
            onFocus={(e) => (e.target.style.borderColor = overLimit ? "#f5a623" : "#4a7c59")}
            onBlur={(e) => (e.target.style.borderColor = overLimit ? "#f5a623" : "#c8d8c8")}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading || overLimit}
            className="shrink-0 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#4a7c59", color: "#fff", borderRadius: "10px" }}
          >
            <Send size={14} />
            Send
          </button>
        </div>
        {nearLimit && (
          <p
            className="max-w-2xl mx-auto mt-1.5 text-xs text-right"
            style={{ color: overLimit ? "#c47c2a" : "#b0c8b0" }}
          >
            {charCount} / 1000
          </p>
        )}
        <p className="max-w-2xl mx-auto mt-1 text-xs" style={{ color: "#c8d8c8" }}>
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -15
```

Expected: No new errors. `/positive-vibes` appears in static routes.

- [ ] **Step 3: Commit**

```bash
git add app/positive-vibes/page.tsx
git commit -m "feat: add Positive Vibes conversation page"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000` (or 3001).

- [ ] **Step 2: Verify dashboard card**

- Dashboard shows Positive Vibes card with green glow
- Card displays a real quote in italic with author (not a static description)
- "Positive Vibes" label and "↻ hourly" indicator visible at the bottom
- Check DevTools → Application → Local Storage → confirm `positive_vibes_quotes`, `positive_vibes_index`, `positive_vibes_last_rotated` are set

- [ ] **Step 3: Verify quote rotation**

In DevTools localStorage, manually set `positive_vibes_last_rotated` to an old timestamp (e.g. `2020-01-01T00:00:00.000Z`) and refresh. The quote index should increment and a different quote should display.

- [ ] **Step 4: Verify conversation page**

Click Positive Vibes card → navigates to `/positive-vibes`
- Sage green header with Sparkles icon
- Quote banner visible at top showing today's quote
- "Share what's on your mind. This is a safe space." placeholder message
- Type a message and press Enter → message appears as green bubble
- Loading dots appear → coach reply appears in white card
- Reply tone should be warm, reflective, no advice-giving

- [ ] **Step 5: Verify char limit**

Type 900+ characters → character count appears (`900 / 1000`)
Type 1001+ characters → count turns orange, Send disabled

- [ ] **Step 6: Verify other cards still work**

Check OCR, Research, Meeting, Mentor, Prompt cards — they should still show their static descriptions normally. The `renderContent` field only applies to Positive Vibes.

- [ ] **Step 7: Final commit**

```bash
git add app/positive-vibes/page.tsx app/api/positive-vibes/quotes/route.ts app/api/positive-vibes/chat/route.ts components/quote-display.tsx components/app-grid.tsx components/ui/spotlight-card.tsx
git commit -m "feat: Positive Vibes webapp complete"
```
