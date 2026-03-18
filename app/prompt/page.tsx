"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Wand2,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  ChevronDown,
} from "lucide-react"

const PLATFORMS = [
  { name: "Claude", category: "Text AI" },
  { name: "ChatGPT", category: "Text AI" },
  { name: "Gemini", category: "Text AI" },
  { name: "Grok", category: "Text AI" },
  { name: "Midjourney", category: "Image" },
  { name: "Stable Diffusion", category: "Image" },
  { name: "DALL·E", category: "Image" },
  { name: "Ideogram", category: "Image" },
  { name: "Kling", category: "Video" },
  { name: "Runway", category: "Video" },
  { name: "Sora", category: "Video" },
  { name: "Nano Banana", category: "Other" },
]

const CATEGORY_COLORS: Record<string, string> = {
  "Text AI": "bg-blue-50 border-blue-200 text-blue-700",
  Image: "bg-purple-50 border-purple-200 text-purple-700",
  Video: "bg-rose-50 border-rose-200 text-rose-700",
  Other: "bg-stone-50 border-stone-200 text-stone-600",
}

const SELECTED_COLORS: Record<string, string> = {
  "Text AI": "bg-blue-600 border-blue-600 text-white",
  Image: "bg-purple-600 border-purple-600 text-white",
  Video: "bg-rose-600 border-rose-600 text-white",
  Other: "bg-stone-700 border-stone-700 text-white",
}

type Step = "setup" | "questions" | "result"

interface QA {
  question: string
  placeholder: string
  answer: string
}

export default function PromptBuilderPage() {
  const [step, setStep] = useState<Step>("setup")
  const [selectedPlatform, setSelectedPlatform] = useState("")
  const [customPlatform, setCustomPlatform] = useState("")
  const [shortPrompt, setShortPrompt] = useState("")
  const [qa, setQa] = useState<QA[]>([])
  const [builtPrompt, setBuiltPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  const platform = customPlatform.trim() || selectedPlatform

  const handleGetQuestions = async () => {
    if (!platform || !shortPrompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/prompt/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, shortPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error)
      setQa(data.questions.map((q: { question: string; placeholder: string }) => ({ ...q, answer: "" })))
      setStep("questions")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleBuildPrompt = async () => {
    setBuilding(true)
    setError(null)
    try {
      const res = await fetch("/api/prompt/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, shortPrompt, qa }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error)
      setBuiltPrompt(data.prompt)
      setStep("result")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBuilding(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(builtPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setStep("setup")
    setSelectedPlatform("")
    setCustomPlatform("")
    setShortPrompt("")
    setQa([])
    setBuiltPrompt("")
    setError(null)
    setShowCustom(false)
  }

  const categories = Array.from(new Set(PLATFORMS.map((p) => p.category)))

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
            <Wand2 size={16} className="text-stone-700" />
            <span
              className="text-lg font-semibold text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Prompt Builder
            </span>
          </div>
          {step !== "setup" && (
            <button
              onClick={handleReset}
              className="ml-auto flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <RotateCcw size={13} />
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {(["setup", "questions", "result"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? "bg-stone-900 text-white"
                  : i < ["setup", "questions", "result"].indexOf(step)
                  ? "bg-stone-300 text-white"
                  : "bg-stone-100 text-stone-400"
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${step === s ? "text-stone-900 font-medium" : "text-stone-400"}`}>
                {s === "setup" ? "Platform & Idea" : s === "questions" ? "Clarify" : "Your Prompt"}
              </span>
              {i < 2 && <ChevronRight size={14} className="text-stone-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Setup */}
        {step === "setup" && (
          <div className="space-y-8">
            <div>
              <h1
                className="text-4xl font-light text-stone-900 mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Build a Better Prompt
              </h1>
              <p className="text-stone-500">
                Select your platform, describe your idea, and we&apos;ll craft the perfect prompt for it.
              </p>
            </div>

            {/* Platform selection */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-3">
                Which platform are you using?
              </label>
              <div className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.filter((p) => p.category === cat).map((p) => (
                        <button
                          key={p.name}
                          onClick={() => {
                            setSelectedPlatform(p.name)
                            setCustomPlatform("")
                            setShowCustom(false)
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                            selectedPlatform === p.name && !customPlatform
                              ? SELECTED_COLORS[cat]
                              : CATEGORY_COLORS[cat]
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Other/custom */}
                <div>
                  <button
                    onClick={() => {
                      setShowCustom(!showCustom)
                      setSelectedPlatform("")
                    }}
                    className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    <ChevronDown size={14} className={`transition-transform ${showCustom ? "rotate-180" : ""}`} />
                    Other platform
                  </button>
                  {showCustom && (
                    <input
                      type="text"
                      value={customPlatform}
                      onChange={(e) => setCustomPlatform(e.target.value)}
                      placeholder="Type platform name..."
                      className="mt-2 w-full max-w-xs px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Short prompt */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                What do you want to create?
              </label>
              <textarea
                value={shortPrompt}
                onChange={(e) => setShortPrompt(e.target.value)}
                placeholder={
                  platform
                    ? `Describe your idea for ${platform}...`
                    : "e.g. A cinematic scene of a robot in a rainy Tokyo street"
                }
                rows={3}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleGetQuestions}
              disabled={!platform || !shortPrompt.trim() || loading}
              className="w-full bg-stone-900 text-white rounded-xl py-3.5 text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Generating questions...
                </>
              ) : (
                <>
                  <ChevronRight size={15} />
                  Continue
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: Clarifying questions */}
        {step === "questions" && (
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-400 bg-stone-100 px-3 py-1 rounded-full mb-3">
                <span className="w-2 h-2 rounded-full bg-stone-400" />
                {platform}
              </div>
              <h2
                className="text-3xl font-light text-stone-900 mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                A few quick questions
              </h2>
              <p className="text-stone-500 text-sm">
                Answer these to help us tailor the prompt. You can skip any you don&apos;t need.
              </p>
            </div>

            <div className="space-y-5">
              {qa.map((item, i) => (
                <div key={i} className="bg-white border border-stone-200 rounded-2xl p-5">
                  <label className="block text-sm font-medium text-stone-800 mb-2">
                    <span className="text-stone-400 mr-2">{i + 1}.</span>
                    {item.question}
                  </label>
                  <input
                    type="text"
                    value={item.answer}
                    onChange={(e) => {
                      const updated = [...qa]
                      updated[i].answer = e.target.value
                      setQa(updated)
                    }}
                    placeholder={item.placeholder}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:bg-white transition-colors"
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleBuildPrompt}
              disabled={building}
              className="w-full bg-stone-900 text-white rounded-xl py-3.5 text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {building ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Building your prompt...
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  Build My Prompt
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 3: Result */}
        {step === "result" && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-400 bg-stone-100 px-3 py-1 rounded-full mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Ready for {platform}
              </div>
              <h2
                className="text-3xl font-light text-stone-900"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your Prompt is Ready
              </h2>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  Optimized for {platform}
                </span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                    copied
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="p-5">
                <pre className="text-sm text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {builtPrompt}
                </pre>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 border border-stone-200 bg-white text-stone-700 rounded-xl py-3 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <RotateCcw size={14} />
                Build Another
              </button>
              <button
                onClick={() => setStep("questions")}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                <Wand2 size={14} />
                Refine Answers
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
