"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, BookOpen, Search, ExternalLink, Download } from "lucide-react"

interface ResearchResult {
  research: {
    title: string
    introduction: string
    keyFindings: string[]
    analysis: string
    conclusion: string
  }
  pdfBase64: string
  driveLink: string
  fileName: string
}

export default function ResearchPage() {
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to generate research")
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob(
      [Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0))],
      { type: "application/pdf" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
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
            <BookOpen size={16} className="text-stone-700" />
            <span
              className="text-lg font-semibold text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Research Tool
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
            AI Research Summaries
          </h1>
          <p className="text-stone-500">
            Enter any topic and get a structured research summary, exported as a
            PDF and saved to your Google Drive.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The impact of AI on education"
              className="w-full pl-10 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full bg-stone-900 text-white rounded-xl py-3.5 text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <BookOpen size={15} />
                Generate Research & Save to Drive
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-8 space-y-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
              <h2
                className="text-2xl font-semibold text-stone-900 leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {result.research.title}
              </h2>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                  Introduction
                </h3>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {result.research.introduction}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                  Key Findings
                </h3>
                <ul className="space-y-1.5">
                  {result.research.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                      <span className="text-stone-400 mt-0.5 shrink-0">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                  Analysis
                </h3>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {result.research.analysis}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                  Conclusion
                </h3>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {result.research.conclusion}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                <Download size={15} />
                Download PDF
              </button>
              <a
                href={result.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 border border-stone-200 bg-white text-stone-700 rounded-xl py-3 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <ExternalLink size={15} />
                View in Google Drive
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
