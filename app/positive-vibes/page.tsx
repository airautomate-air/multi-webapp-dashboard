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
    return quotes[isNaN(index) ? 0 : index] ?? FALLBACK_QUOTE
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
