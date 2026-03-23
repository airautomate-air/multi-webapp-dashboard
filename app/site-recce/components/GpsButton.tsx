// app/site-recce/components/GpsButton.tsx
"use client"

import { useState } from "react"
import { MapPin, Loader2 } from "lucide-react"

interface GpsButtonProps {
  onLocation: (address: string, lat: number, lng: number) => void
}

export default function GpsButton({ onLocation }: GpsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function detect() {
    setError("")
    setLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      )
      const { latitude: lat, longitude: lng } = pos.coords
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { "User-Agent": "SiteRecceApp/1.0" } }
      )
      const data = await res.json()
      onLocation(data.display_name ?? `${lat}, ${lng}`, lat, lng)
    } catch (err) {
      const geoErr = err as GeolocationPositionError
      const msg =
        geoErr?.code === 1
          ? "Location permission denied. Please type the address."
          : geoErr?.code === 3
          ? "Location timed out. Please type the address."
          : "Could not get location. Please type address."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={detect}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
        {loading ? "Detecting..." : "Use GPS"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
