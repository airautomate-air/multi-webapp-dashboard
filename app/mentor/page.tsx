"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Send, Brain } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

const PATTERNS_KEY = "mentor_patterns"

function getStoredPatterns(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PATTERNS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mergePatterns(existing: string[], incoming: string[]): string[] {
  const normalized = existing.map((p) => p.toLowerCase())
  const toAdd = incoming.filter((p) => !normalized.includes(p.toLowerCase()))
  return [...existing, ...toAdd]
}

function savePatterns(patterns: string[]) {
  try {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns))
  } catch {
    // Ignore storage errors
  }
}

export default function MentorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPatterns, setHasPatterns] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setHasPatterns(getStoredPatterns().length > 0)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { role: "user", content: text }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput("")
    setLoading(true)
    setError(null)

    if (textareaRef.current) textareaRef.current.style.height = "auto"

    try {
      const patterns = getStoredPatterns()

      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, patterns }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Mentor failed to respond")

      const assistantMessage: Message = { role: "assistant", content: data.reply }
      setMessages([...updatedMessages, assistantMessage])

      // Silently extract and store patterns
      fetch("/api/mentor/extract-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorReply: data.reply }),
      })
        .then((r) => r.json())
        .then(({ patterns: newPatterns }) => {
          if (newPatterns?.length) {
            const merged = mergePatterns(getStoredPatterns(), newPatterns)
            savePatterns(merged)
            setHasPatterns(true)
          }
        })
        .catch(() => {})
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
    <div className="flex flex-col h-screen" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 py-4 border-b shrink-0"
        style={{ background: "#0f0f0f", borderColor: "#1f1f1f" }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "#555" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span style={{ color: "#222" }}>|</span>
        <div className="flex items-center gap-2">
          <Brain size={16} style={{ color: "#888" }} />
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "#fff", fontFamily: "var(--font-display)" }}
          >
            Mentor
          </span>
        </div>
        <span
          className="ml-auto text-xs italic hidden sm:block"
          style={{ color: "#333" }}
        >
          No praise. No curve. Just truth.
        </span>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div
              className="text-center text-xs py-2 px-4 rounded-lg border mb-6"
              style={{ color: "#444", borderColor: "#1a1a1a" }}
            >
              {hasPatterns
                ? "New session — Mentor knows your patterns."
                : "New session — share an idea, plan, or piece of work."}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="max-w-2xl mx-auto">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[72%] px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: "#1e1e1e",
                    border: "1px solid #2a2a2a",
                    borderRadius: "12px 12px 2px 12px",
                    color: "#ccc",
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
                    background: "#111",
                    border: "1px solid #1f1f1f",
                    borderLeft: "3px solid #c0392b",
                    borderRadius: "0 12px 12px 0",
                    color: "#bbb",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="max-w-2xl mx-auto flex justify-start">
            <div
              className="px-4 py-3"
              style={{
                background: "#111",
                border: "1px solid #1f1f1f",
                borderLeft: "3px solid #c0392b",
                borderRadius: "0 12px 12px 0",
              }}
            >
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      background: "#555",
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto flex justify-start">
            <div
              className="max-w-[82%] px-4 py-3 text-sm"
              style={{
                background: "#1a0a0a",
                border: "1px solid #3a1010",
                borderLeft: "3px solid #c0392b",
                borderRadius: "0 12px 12px 0",
                color: "#e74c3c",
              }}
            >
              Error: {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-3 border-t"
        style={{ background: "#0c0c0c", borderColor: "#1a1a1a" }}
      >
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Share an idea, plan, or piece of work..."
            rows={1}
            className="flex-1 resize-none text-sm leading-relaxed outline-none transition-colors"
            style={{
              background: "#141414",
              border: "1px solid #222",
              borderRadius: "10px",
              padding: "10px 14px",
              color: "#ccc",
              minHeight: "42px",
              maxHeight: "160px",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#333")}
            onBlur={(e) => (e.target.style.borderColor = "#222")}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="shrink-0 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#c0392b", color: "#fff", borderRadius: "10px" }}
          >
            <Send size={14} />
            Submit
          </button>
        </div>
        <p className="max-w-2xl mx-auto mt-1.5 text-xs" style={{ color: "#2a2a2a" }}>
          Shift+Enter for new line · Enter to submit
        </p>
      </div>
    </div>
  )
}
