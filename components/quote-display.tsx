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
