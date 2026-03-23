// app/site-recce/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteEntry, createEmptySite } from "./types"
import { loadSites, upsertSite, deleteSite } from "./storage"
import SiteList from "./components/SiteList"
import Wizard from "./components/Wizard"
import SiteDetail from "./components/SiteDetail"

type View =
  | { kind: "list" }
  | { kind: "wizard"; site: SiteEntry }
  | { kind: "detail"; site: SiteEntry }

export default function SiteReccePage() {
  const [sites, setSites] = useState<SiteEntry[]>([])
  const [view, setView] = useState<View>({ kind: "list" })

  useEffect(() => {
    setSites(loadSites())
  }, [])

  function refreshSites() {
    setSites(loadSites())
  }

  function handleNew() {
    setView({ kind: "wizard", site: createEmptySite() })
  }

  function handleSelect(site: SiteEntry) {
    setView({ kind: "detail", site })
  }

  function handleWizardDone(site: SiteEntry) {
    upsertSite(site)
    refreshSites()
    setView({ kind: "detail", site })
  }

  function handleDelete(id: string) {
    deleteSite(id)
    setSites(loadSites())
    setView({ kind: "list" })
  }

  function handleUpdate(updated: SiteEntry) {
    upsertSite(updated)
    const freshList = loadSites()
    setSites(freshList)
    const canonical = freshList.find(s => s.id === updated.id) ?? updated
    setView({ kind: "detail", site: canonical })
  }

  const pageTitle =
    view.kind === "list"
      ? "Site Recce"
      : view.kind === "wizard"
      ? view.site.name ? `Editing: ${view.site.name}` : "New Site"
      : view.site.name || "Site Detail"

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-stone-300">·</span>
          <span className="text-sm font-medium text-stone-700">{pageTitle}</span>
          {view.kind === "list" && (
            <>
              <div className="flex-1" />
              <button
                onClick={handleNew}
                className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors"
              >
                + Add Site
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24">
        {view.kind === "list" && (
          <SiteList
            sites={sites}
            onSelect={handleSelect}
            onNew={handleNew}
          />
        )}
        {view.kind === "wizard" && (
          <Wizard
            initial={view.site}
            onDone={handleWizardDone}
            onCancel={() => setView({ kind: "list" })}
          />
        )}
        {view.kind === "detail" && (
          <SiteDetail
            site={view.site}
            onBack={() => setView({ kind: "list" })}
            onEdit={site => setView({ kind: "wizard", site })}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  )
}
