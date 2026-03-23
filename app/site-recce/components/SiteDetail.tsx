// app/site-recce/components/SiteDetail.tsx
"use client"

import { useState } from "react"
import { SiteEntry } from "../types"
import MediaTab from "./MediaTab"
import { ArrowLeft, ExternalLink, MapPin, Pencil } from "lucide-react"

interface Props {
  site: SiteEntry
  onBack: () => void
  onEdit: (site: SiteEntry) => void
  onUpdate: (site: SiteEntry) => void
}

const TABS = ["Land", "Legal", "Surroundings", "Financials", "📷 Media"] as const

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-stone-100">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800 text-right max-w-[55%]">{String(value)}</span>
    </div>
  )
}

export default function SiteDetail({ site, onBack, onEdit, onUpdate }: Props) {
  const [tab, setTab] = useState(0)

  const pricePerSqm = site.askingPriceVnd && site.areaSqm
    ? Math.round(site.askingPriceVnd / site.areaSqm).toLocaleString()
    : null

  const mapsUrl = site.lat && site.lng
    ? `https://maps.google.com/?q=${site.lat},${site.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(site.address)}`

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors min-h-[44px] px-1"
        >
          <ArrowLeft size={16} /> All Sites
        </button>
        <button
          type="button"
          onClick={() => onEdit(site)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors min-h-[44px] px-1"
        >
          <Pencil size={13} /> Edit
        </button>
      </div>

      {/* Site title + actions */}
      <div className="mb-4">
        <h1
          className="text-xl font-semibold text-stone-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {site.name || "Unnamed Site"}
        </h1>
        {site.address && (
          <p className="text-xs text-stone-500 mt-0.5">{site.address}</p>
        )}
        {site.areaSqm && (
          <p className="text-xs text-stone-400 mt-0.5">{site.areaSqm} m²</p>
        )}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {((site.lat && site.lng) || site.address) && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg transition-colors min-h-[44px]"
            >
              <MapPin size={12} /> Open in Maps
            </a>
          )}
          {site.pdfDriveUrl && (
            <a
              href={site.pdfDriveUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink size={12} /> PDF Report
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-4 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(i)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors min-h-[44px]
              ${i === tab
                ? "border-b-2 border-stone-900 text-stone-900"
                : "text-stone-400 hover:text-stone-600"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 0 && (
          <div>
            <Row label="Area" value={site.areaSqm ? `${site.areaSqm} m²` : null} />
            <Row label="Shape / Frontage" value={site.shapeFrontage} />
            <Row label="Terrain" value={site.terrain} />
            <Row label="Flood Risk" value={site.floodRisk} />
            {site.landNotes && (
              <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{site.landNotes}</p>
            )}
            {!site.areaSqm && !site.shapeFrontage && !site.terrain && !site.floodRisk && !site.landNotes && (
              <p className="text-xs text-stone-400 py-4 text-center">No land details recorded.</p>
            )}
          </div>
        )}

        {tab === 1 && (
          <div>
            <Row label="Title Type" value={site.titleType} />
            <Row label="Zoning" value={site.zoning} />
            <Row label="Ownership" value={site.ownershipStatus} />
            <Row label="Permit Status" value={site.permitStatus} />
            {site.legalNotes && (
              <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{site.legalNotes}</p>
            )}
            {!site.titleType && !site.zoning && !site.ownershipStatus && !site.permitStatus && !site.legalNotes && (
              <p className="text-xs text-stone-400 py-4 text-center">No legal details recorded.</p>
            )}
          </div>
        )}

        {tab === 2 && (
          <div>
            <Row label="Road Access" value={site.roadAccess} />
            <Row label="Amenities" value={site.nearbyAmenities.length > 0 ? site.nearbyAmenities.join(", ") : null} />
            <Row label="Competition" value={site.competition} />
            <Row label="Area Vibe" value={site.areaVibe} />
            {site.surroundingsNotes && (
              <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{site.surroundingsNotes}</p>
            )}
            {!site.roadAccess && !site.nearbyAmenities.length && !site.competition && !site.areaVibe && !site.surroundingsNotes && (
              <p className="text-xs text-stone-400 py-4 text-center">No surroundings details recorded.</p>
            )}
          </div>
        )}

        {tab === 3 && (
          <div>
            <Row
              label="Asking Price"
              value={site.askingPriceVnd ? `${site.askingPriceVnd.toLocaleString()} VND` : null}
            />
            <Row
              label="Price / m²"
              value={pricePerSqm ? `${pricePerSqm} VND` : null}
            />
            <Row
              label="Est. Dev Cost"
              value={site.estDevelopmentCostVnd ? `${site.estDevelopmentCostVnd.toLocaleString()} VND` : null}
            />
            <Row
              label="Rating"
              value={site.rating ? "★".repeat(site.rating) + "☆".repeat(5 - site.rating) : null}
            />
            {site.financialNotes && (
              <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{site.financialNotes}</p>
            )}
            {!site.askingPriceVnd && !site.estDevelopmentCostVnd && !site.rating && !site.financialNotes && (
              <p className="text-xs text-stone-400 py-4 text-center">No financial details recorded.</p>
            )}
          </div>
        )}

        {tab === 4 && (
          <MediaTab site={site} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  )
}
