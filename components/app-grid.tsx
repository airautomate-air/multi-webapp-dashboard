"use client"

import React from "react"
import { GlowCard } from "@/components/ui/spotlight-card"
import { FileText, BookOpen, Mic, Wand2, Brain, Sparkles, MapPin } from "lucide-react"
import Link from "next/link"
import QuoteDisplay from "@/components/quote-display"

interface App {
  href: string
  icon: React.ElementType
  title: string
  description: string
  glowColor: "blue" | "purple" | "green" | "red" | "orange"
  renderContent?: () => React.ReactNode
}

const apps: App[] = [
  {
    href: "/ocr",
    icon: FileText,
    title: "OCR Tool",
    description:
      "Upload images and extract all text into a Word document, saved to your Google Drive.",
    glowColor: "blue" as const,
  },
  {
    href: "/research",
    icon: BookOpen,
    title: "Research Tool",
    description:
      "Enter any topic and get an AI-powered research summary exported as a PDF to Google Drive.",
    glowColor: "purple" as const,
  },
  {
    href: "/meeting",
    icon: Mic,
    title: "Meeting Transcription",
    description:
      "Transcribe meetings live, get an AI summary with action items, and save everything to Google Sheets.",
    glowColor: "blue" as const,
  },
  {
    href: "/prompt",
    icon: Wand2,
    title: "Prompt Builder",
    description:
      "Pick your AI platform, describe your idea, answer a few questions, and get a fully optimized prompt.",
    glowColor: "purple" as const,
  },
  {
    href: "/mentor",
    icon: Brain,
    title: "Mentor",
    description:
      "Share an idea, plan, or piece of work. Get ruthless feedback — no praise, no curve. Just truth.",
    glowColor: "purple" as const,
  },
  {
    href: "/positive-vibes",
    icon: Sparkles,
    title: "Positive Vibes",
    description: "Your daily dose of calm and inspiration.",
    glowColor: "green" as const,
    renderContent: () => <QuoteDisplay />,
  },
  {
    href: "/site-recce",
    icon: MapPin,
    title: "Site Recce",
    description: "Evaluate real estate sites in Vietnam. Capture notes, photos, voice memos, and export reports.",
    glowColor: "green" as const,
  },
]

export default function AppGrid({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
      {apps.map((app) => (
        <Link
          key={app.href}
          href={isSignedIn ? app.href : "#"}
          className={`w-full max-w-sm ${
            !isSignedIn
              ? "opacity-60 cursor-not-allowed pointer-events-none"
              : "group"
          }`}
        >
          <GlowCard
            customSize
            glowColor={app.glowColor}
            className="w-full h-64 overflow-hidden transition-transform duration-300 group-hover:-translate-y-1"
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div className="p-1">
                <div className="w-10 h-10 rounded-xl bg-white/60 border border-stone-200 flex items-center justify-center mb-4 shadow-sm">
                  <app.icon size={20} className="text-stone-700" />
                </div>
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
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-stone-400 group-hover:text-stone-600 transition-colors">
                Open tool
                <span className="group-hover:translate-x-0.5 transition-transform inline-block">
                  →
                </span>
              </div>
            </div>
          </GlowCard>
        </Link>
      ))}
    </div>
  )
}
