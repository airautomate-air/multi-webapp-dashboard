// app/site-recce/components/Wizard.tsx
"use client"

import { useState } from "react"
import { SiteEntry, AMENITY_OPTIONS } from "../types"
import { upsertSite } from "../storage"
import VoiceNote from "./VoiceNote"
import GpsButton from "./GpsButton"
import { ChevronLeft, ChevronRight, Loader2, CheckCircle } from "lucide-react"

interface Props {
  initial: SiteEntry
  onDone: (site: SiteEntry) => void
  onCancel: () => void
}

const STEPS = ["Land", "Legal", "Surroundings", "Financials", "Review"]

export default function Wizard({ initial, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [site, setSite] = useState<SiteEntry>(initial)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState("")

  function update(patch: Partial<SiteEntry>) {
    const updated = { ...site, ...patch, updatedAt: new Date().toISOString() }
    setSite(updated)
    upsertSite(updated)
  }

  function appendNote(field: keyof SiteEntry, text: string) {
    const existing = (site[field] as string) || ""
    update({ [field]: existing ? existing + " " + text : text } as Partial<SiteEntry>)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  async function saveToSheets() {
    setSaving(true)
    try {
      const res = await fetch("/api/site-recce/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(site),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updated = { ...site, savedToSheets: true, sheetsUrl: data.sheetsUrl, updatedAt: new Date().toISOString() }
      setSite(updated)
      upsertSite(updated)
      showToast("Saved to Sheets ✓")
    } catch {
      showToast("Failed to save to Sheets. Data is safe locally.")
    } finally {
      setSaving(false)
    }
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const res = await fetch("/api/site-recce/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(site),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updated = { ...site, pdfDriveUrl: data.pdfDriveUrl, updatedAt: new Date().toISOString() }
      setSite(updated)
      upsertSite(updated)
      showToast("PDF exported to Drive ✓")
    } catch {
      showToast("Export failed. Try again.")
    } finally {
      setExporting(false)
    }
  }

  const inputCls = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
  const selectCls = inputCls

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${i < step ? "bg-green-500 text-white" : i === step ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <div className="text-[10px] text-stone-500 hidden sm:block">{s}</div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-green-400" : "bg-stone-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto pb-4">
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-stone-800">Land &amp; Physical</h2>
            <input className={inputCls} placeholder="Site name *" value={site.name} onChange={e => update({ name: e.target.value })} />
            <div className="flex flex-col gap-1.5">
              <input className={inputCls} placeholder="Address" value={site.address} onChange={e => update({ address: e.target.value })} />
              <GpsButton onLocation={(address, lat, lng) => update({ address, lat, lng })} />
            </div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Area (m²)" type="number" value={site.areaSqm ?? ""} onChange={e => update({ areaSqm: e.target.value ? Number(e.target.value) : null })} />
              <input className={inputCls} placeholder="Shape / Frontage" value={site.shapeFrontage} onChange={e => update({ shapeFrontage: e.target.value })} />
            </div>
            <select className={selectCls} value={site.terrain} onChange={e => update({ terrain: e.target.value as SiteEntry["terrain"] })}>
              <option value="">Terrain...</option>
              <option value="flat">Flat</option>
              <option value="slope">Slope</option>
              <option value="uneven">Uneven</option>
            </select>
            <select className={selectCls} value={site.floodRisk} onChange={e => update({ floodRisk: e.target.value as SiteEntry["floodRisk"] })}>
              <option value="">Flood Risk...</option>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
            <VoiceNote field="landNotes" onTranscript={t => appendNote("landNotes", t)} />
            <textarea className={inputCls} rows={3} placeholder="Notes..." value={site.landNotes} onChange={e => update({ landNotes: e.target.value })} />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-stone-800">Legal &amp; Planning</h2>
            <select className={selectCls} value={site.titleType} onChange={e => update({ titleType: e.target.value as SiteEntry["titleType"] })}>
              <option value="">Title Type...</option>
              <option value="red_book">Red Book</option>
              <option value="pink_book">Pink Book</option>
              <option value="no_title">No Title</option>
            </select>
            <select className={selectCls} value={site.zoning} onChange={e => update({ zoning: e.target.value as SiteEntry["zoning"] })}>
              <option value="">Zoning...</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="mixed">Mixed</option>
              <option value="agricultural">Agricultural</option>
            </select>
            <select className={selectCls} value={site.ownershipStatus} onChange={e => update({ ownershipStatus: e.target.value as SiteEntry["ownershipStatus"] })}>
              <option value="">Ownership Status...</option>
              <option value="clear">Clear</option>
              <option value="disputed">Disputed</option>
              <option value="unknown">Unknown</option>
            </select>
            <select className={selectCls} value={site.permitStatus} onChange={e => update({ permitStatus: e.target.value as SiteEntry["permitStatus"] })}>
              <option value="">Permit Status...</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="none">None</option>
            </select>
            <VoiceNote field="legalNotes" onTranscript={t => appendNote("legalNotes", t)} />
            <textarea className={inputCls} rows={3} placeholder="Notes..." value={site.legalNotes} onChange={e => update({ legalNotes: e.target.value })} />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-stone-800">Surroundings</h2>
            <select className={selectCls} value={site.roadAccess} onChange={e => update({ roadAccess: e.target.value as SiteEntry["roadAccess"] })}>
              <option value="">Road Access...</option>
              <option value="main_road">Main Road</option>
              <option value="side_street">Side Street</option>
              <option value="alley">Alley</option>
            </select>
            <div>
              <p className="text-xs text-stone-500 mb-1.5">Nearby Amenities</p>
              <div className="flex flex-wrap gap-2">
                {(AMENITY_OPTIONS as readonly string[]).map(a => (
                  <label key={a} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox"
                      checked={site.nearbyAmenities.includes(a as typeof site.nearbyAmenities[number])}
                      onChange={e => update({ nearbyAmenities: e.target.checked ? [...site.nearbyAmenities, a as typeof site.nearbyAmenities[number]] : site.nearbyAmenities.filter(x => x !== a) })}
                    />
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <input className={inputCls} placeholder="Competition nearby" value={site.competition} onChange={e => update({ competition: e.target.value })} />
            <select className={selectCls} value={site.areaVibe} onChange={e => update({ areaVibe: e.target.value as SiteEntry["areaVibe"] })}>
              <option value="">Area Vibe...</option>
              <option value="quiet">Quiet</option>
              <option value="busy">Busy</option>
              <option value="up_and_coming">Up-and-coming</option>
              <option value="declining">Declining</option>
            </select>
            <VoiceNote field="surroundingsNotes" onTranscript={t => appendNote("surroundingsNotes", t)} />
            <textarea className={inputCls} rows={3} placeholder="Notes..." value={site.surroundingsNotes} onChange={e => update({ surroundingsNotes: e.target.value })} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-stone-800">Financials</h2>
            <input className={inputCls} placeholder="Asking Price (VND)" type="number" value={site.askingPriceVnd ?? ""} onChange={e => update({ askingPriceVnd: e.target.value ? Number(e.target.value) : null })} />
            {site.askingPriceVnd && site.areaSqm && (
              <p className="text-xs text-stone-500">Price/m²: {Math.round(site.askingPriceVnd / site.areaSqm).toLocaleString()} VND</p>
            )}
            <input className={inputCls} placeholder="Est. Development Cost (VND, optional)" type="number" value={site.estDevelopmentCostVnd ?? ""} onChange={e => update({ estDevelopmentCostVnd: e.target.value ? Number(e.target.value) : null })} />
            <div>
              <p className="text-xs text-stone-500 mb-1.5">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => update({ rating: n as SiteEntry["rating"] })}
                    className={`text-2xl ${n <= (site.rating ?? 0) ? "text-yellow-400" : "text-stone-200"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <VoiceNote field="financialNotes" onTranscript={t => appendNote("financialNotes", t)} />
            <textarea className={inputCls} rows={3} placeholder="Notes..." value={site.financialNotes} onChange={e => update({ financialNotes: e.target.value })} />
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-stone-800">Review &amp; Save</h2>
            {!site.savedToSheets && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                ⚠ Not yet saved to Google Sheets. Tap &quot;Save to Sheets&quot; below.
              </div>
            )}
            <div className="text-sm space-y-1 text-stone-600">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-1">Land & Physical</p>
              <p><strong>Name:</strong> {site.name}</p>
              {site.address && <p><strong>Address:</strong> {site.address}</p>}
              {site.areaSqm && <p><strong>Area:</strong> {site.areaSqm} m²</p>}
              {site.shapeFrontage && <p><strong>Shape/Frontage:</strong> {site.shapeFrontage}</p>}
              {site.terrain && <p><strong>Terrain:</strong> {site.terrain}</p>}
              {site.floodRisk && <p><strong>Flood Risk:</strong> {site.floodRisk}</p>}
              {site.landNotes && <p><strong>Land Notes:</strong> {site.landNotes}</p>}

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-3">Legal & Planning</p>
              {site.titleType && <p><strong>Title Type:</strong> {site.titleType}</p>}
              {site.zoning && <p><strong>Zoning:</strong> {site.zoning}</p>}
              {site.ownershipStatus && <p><strong>Ownership:</strong> {site.ownershipStatus}</p>}
              {site.permitStatus && <p><strong>Permit Status:</strong> {site.permitStatus}</p>}
              {site.legalNotes && <p><strong>Legal Notes:</strong> {site.legalNotes}</p>}

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-3">Surroundings</p>
              {site.roadAccess && <p><strong>Road Access:</strong> {site.roadAccess}</p>}
              {site.nearbyAmenities.length > 0 && <p><strong>Amenities:</strong> {site.nearbyAmenities.join(", ")}</p>}
              {site.competition && <p><strong>Competition:</strong> {site.competition}</p>}
              {site.areaVibe && <p><strong>Area Vibe:</strong> {site.areaVibe}</p>}
              {site.surroundingsNotes && <p><strong>Surroundings Notes:</strong> {site.surroundingsNotes}</p>}

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-3">Financials</p>
              {site.askingPriceVnd && <p><strong>Asking Price:</strong> {site.askingPriceVnd.toLocaleString()} VND</p>}
              {site.askingPriceVnd && site.areaSqm && (
                <p><strong>Price/m²:</strong> {Math.round(site.askingPriceVnd / site.areaSqm).toLocaleString()} VND</p>
              )}
              {site.estDevelopmentCostVnd && <p><strong>Est. Dev Cost:</strong> {site.estDevelopmentCostVnd.toLocaleString()} VND</p>}
              {site.rating && <p><strong>Rating:</strong> {"★".repeat(site.rating)}{"☆".repeat(5 - site.rating)}</p>}
              {site.financialNotes && <p><strong>Financial Notes:</strong> {site.financialNotes}</p>}

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mt-3">Media</p>
              <p><strong>Uploaded files:</strong> {site.mediaFiles.filter(f => f.status === "uploaded").length}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={saveToSheets} disabled={saving}
                className="flex items-center justify-center gap-2 bg-stone-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><CheckCircle size={15} /> Save to Sheets</>}
              </button>
              <button onClick={exportPdf} disabled={exporting}
                className="flex items-center justify-center gap-2 bg-stone-100 text-stone-800 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                {exporting ? <><Loader2 size={15} className="animate-spin" /> Exporting...</> : "Export PDF to Drive"}
              </button>
              {site.pdfDriveUrl && (
                <a href={site.pdfDriveUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline text-center">
                  View PDF on Drive
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <button onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ChevronLeft size={16} /> {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < 4 ? (
          <button onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && !site.name}
            className="flex items-center gap-1 text-sm bg-stone-900 text-white px-4 py-2 rounded-lg disabled:opacity-40">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => onDone(site)}
            className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg">
            Done
          </button>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
