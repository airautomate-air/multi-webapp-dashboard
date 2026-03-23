import { SiteEntry, createEmptySite } from "./types"

const KEY = "site-recce-sites"

export function loadSites(): SiteEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw: unknown[] = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return raw.map(r => ({ ...createEmptySite(), ...(r as Partial<SiteEntry>) }))
  } catch {
    return []
  }
}

export function saveSites(sites: SiteEntry[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(sites))
}

export function upsertSite(site: SiteEntry): void {
  const sites = loadSites()
  const exists = sites.some(s => s.id === site.id)
  const next = exists
    ? sites.map(s => s.id === site.id ? site : s)
    : [...sites, site]
  saveSites(next)
}

export function deleteSite(id: string): void {
  saveSites(loadSites().filter(s => s.id !== id))
}
