// app/site-recce/components/SiteList.tsx
import { SiteEntry } from "../types"
import { MapPin, AlertCircle } from "lucide-react"

interface Props {
  sites: SiteEntry[]
  onSelect: (site: SiteEntry) => void
  onNew: () => void
}

function badge(label: string, done: boolean, partial?: boolean) {
  const color = done
    ? "bg-green-100 text-green-700"
    : partial
    ? "bg-yellow-100 text-yellow-700"
    : "bg-stone-100 text-stone-400"
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${color}`}>
      {label}{done ? " ✓" : ""}
    </span>
  )
}

function completionBadges(site: SiteEntry) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {badge("Land", !!site.name && !!site.address)}
      {badge("Legal", !!site.titleType && !!site.zoning)}
      {badge("Surroundings", !!site.roadAccess, site.nearbyAmenities.length > 0)}
      {badge("Financials", !!site.askingPriceVnd && !!site.rating)}
    </div>
  )
}

export default function SiteList({ sites, onSelect, onNew }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {sites.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-12">
          No sites yet. Tap below to add your first site.
        </p>
      )}
      {sites.map(site => (
        <button
          key={site.id}
          type="button"
          onClick={() => onSelect(site)}
          className="w-full text-left border border-stone-200 rounded-xl p-4 bg-white hover:border-stone-300 hover:shadow-sm transition-all min-h-[44px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-stone-900">{site.name || "Unnamed Site"}</div>
              <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                <MapPin size={11} /> {site.address || "No address"}
                {site.areaSqm ? ` · ${site.areaSqm} m²` : ""}
              </div>
            </div>
            {!site.savedToSheets && (
              <span title="Not saved to Sheets" className="text-yellow-500 mt-0.5">
                <AlertCircle size={14} />
              </span>
            )}
          </div>
          {completionBadges(site)}
          {site.rating && (
            <div className="text-xs text-stone-400 mt-1.5">
              {"★".repeat(site.rating)}{"☆".repeat(5 - site.rating)}
            </div>
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={onNew}
        className="w-full border-2 border-dashed border-stone-200 rounded-xl p-4 text-stone-400 hover:border-stone-300 hover:text-stone-500 transition-colors text-sm min-h-[44px]"
      >
        + Add new site
      </button>
    </div>
  )
}
