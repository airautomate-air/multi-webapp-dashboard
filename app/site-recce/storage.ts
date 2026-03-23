import { SiteEntry } from "./types"

const KEY = "site-recce-sites"

export function loadSites(): SiteEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveSites(sites: SiteEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(sites))
}

export function upsertSite(site: SiteEntry): void {
  const sites = loadSites()
  const updated = { ...site, updatedAt: new Date().toISOString() }
  const exists = sites.some(s => s.id === site.id)
  const next = exists
    ? sites.map(s => s.id === site.id ? updated : s)
    : [...sites, updated]
  saveSites(next)
}

export function deleteSite(id: string): void {
  saveSites(loadSites().filter(s => s.id !== id))
}
