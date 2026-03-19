"use client"

import { useEffect, useState, useRef } from "react"

type WeatherType = "sunny" | "cloudy" | "rainy" | "thunderstorm" | "snowy" | "night" | "foggy" | "loading"

interface WeatherInfo {
  type: WeatherType
  description: string
  temp: number | null
  location: string | null
}

function getWeatherType(code: number, isNight: boolean): WeatherType {
  if (isNight && (code === 0 || code === 1)) return "night"
  if (code === 0 || code === 1) return "sunny"
  if (code === 2 || code === 3) return "cloudy"
  if (code === 45 || code === 48) return "foggy"
  if (code >= 51 && code <= 67) return "rainy"
  if (code >= 71 && code <= 77) return "snowy"
  if (code >= 80 && code <= 82) return "rainy"
  if (code >= 85 && code <= 86) return "snowy"
  if (code >= 95) return "thunderstorm"
  return "cloudy"
}

function getDescription(code: number): string {
  if (code === 0) return "Clear sky"
  if (code === 1) return "Mainly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Foggy"
  if (code >= 51 && code <= 55) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code >= 85 && code <= 86) return "Snow showers"
  if (code === 95) return "Thunderstorm"
  if (code >= 96) return "Severe thunderstorm"
  return "Cloudy"
}

// Real Unsplash photo backgrounds per weather type
const PHOTOS: Record<WeatherType, string> = {
  sunny:
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=90",
  cloudy:
    "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1920&q=90",
  rainy:
    "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1920&q=90",
  thunderstorm:
    "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=1920&q=90",
  snowy:
    "https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=1920&q=90",
  night:
    "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=90",
  foggy:
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=90",
  loading:
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80",
}

// Overlay tint per weather type (keeps text readable over bright photos)
const OVERLAYS: Record<WeatherType, string> = {
  sunny:       "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.3) 100%)",
  cloudy:      "linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.35) 100%)",
  rainy:       "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 40%, rgba(0,0,0,0.50) 100%)",
  thunderstorm:"linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.50) 40%, rgba(0,0,0,0.65) 100%)",
  snowy:       "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.30) 100%)",
  night:       "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.45) 100%)",
  foggy:       "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(200,200,200,0.20) 50%, rgba(0,0,0,0.30) 100%)",
  loading:     "rgba(0,0,0,0.1)",
}

// ── Canvas Rain ──────────────────────────────────────────────────────────────
function RainCanvas({ heavy = false }: { heavy?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const c = ctx
    const cv = canvas

    const resize = () => {
      cv.width = window.innerWidth
      cv.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const count = heavy ? 500 : 250
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      length: heavy ? 18 + Math.random() * 22 : 10 + Math.random() * 16,
      speed: heavy ? 18 + Math.random() * 12 : 9 + Math.random() * 9,
      opacity: 0.08 + Math.random() * 0.35,
      width: heavy ? 0.8 + Math.random() * 0.8 : 0.5 + Math.random() * 0.6,
    }))

    // Slight angle for natural look
    const angleRad = (12 * Math.PI) / 180
    const dx = Math.sin(angleRad)
    const dy = Math.cos(angleRad)

    let animId: number
    function draw() {
      c.clearRect(0, 0, cv.width, cv.height)
      drops.forEach((d) => {
        c.beginPath()
        c.moveTo(d.x, d.y)
        c.lineTo(d.x + d.length * dx, d.y + d.length * dy)
        c.strokeStyle = `rgba(200, 228, 248, ${d.opacity})`
        c.lineWidth = d.width
        c.stroke()
        d.x += d.speed * dx * 0.6
        d.y += d.speed * dy
        if (d.y > cv.height + d.length) {
          d.y = -d.length
          d.x = Math.random() * cv.width
        }
        if (d.x > cv.width + d.length) {
          d.x = -d.length
        }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [heavy])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  )
}

// ── Canvas Snow ──────────────────────────────────────────────────────────────
function SnowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const c = ctx
    const cv = canvas

    const resize = () => {
      cv.width = window.innerWidth
      cv.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const flakes = Array.from({ length: 220 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.8 + Math.random() * 3.5,
      speed: 0.4 + Math.random() * 1.8,
      opacity: 0.3 + Math.random() * 0.65,
      drift: (Math.random() - 0.5) * 0.6,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.005 + Math.random() * 0.015,
    }))

    let animId: number
    function draw() {
      c.clearRect(0, 0, cv.width, cv.height)
      flakes.forEach((f) => {
        c.beginPath()
        c.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        c.fillStyle = `rgba(255,255,255,${f.opacity})`
        c.shadowBlur = f.r > 2 ? 8 : 4
        c.shadowColor = "rgba(255,255,255,0.7)"
        c.fill()
        c.shadowBlur = 0

        f.wobble += f.wobbleSpeed
        f.x += f.drift + Math.sin(f.wobble) * 0.4
        f.y += f.speed

        if (f.y > cv.height + 5) {
          f.y = -5
          f.x = Math.random() * cv.width
        }
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}

// ── Realistic Lightning (screen flash only — no cartoon bolts) ────────────────
function LightningFlash() {
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    function scheduleFlash() {
      const delay = 3000 + Math.random() * 7000
      const timer = setTimeout(() => {
        // Quick double-flash
        setFlash(1)
        setTimeout(() => setFlash(0), 60)
        setTimeout(() => setFlash(0.6), 100)
        setTimeout(() => setFlash(0), 180)
        scheduleFlash()
      }, delay)
      return timer
    }
    const t = scheduleFlash()
    return () => clearTimeout(t)
  }, [])

  if (flash === 0) return null
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `rgba(210, 230, 255, ${flash})`,
        transition: "opacity 0.04s",
      }}
    />
  )
}

// ── Fog layers ────────────────────────────────────────────────────────────────
function FogLayer() {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(220,225,230,0.55) 0%, transparent 70%)",
          animation: "fogDrift 25s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 50% at 20% 80%, rgba(200,210,220,0.40) 0%, transparent 70%)",
          animation: "fogDrift 35s ease-in-out infinite alternate-reverse",
        }}
      />
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function WeatherBackground({ children }: { children: React.ReactNode }) {
  const [weather, setWeather] = useState<WeatherInfo>({
    type: "loading",
    description: "",
    temp: null,
    location: null,
  })
  const [photoLoaded, setPhotoLoaded] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather({ type: "sunny", description: "Clear sky", temp: null, location: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords
          let locationName: string | null = null
          try {
            const geo = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            )
            const geoData = await geo.json()
            locationName =
              geoData.address?.city ||
              geoData.address?.town ||
              geoData.address?.village ||
              null
          } catch {}

          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&temperature_unit=celsius`
          )
          const data = await res.json()
          const code: number = data.current.weather_code
          const isNight = data.current.is_day === 0
          const temp = Math.round(data.current.temperature_2m)
          setWeather({
            type: getWeatherType(code, isNight),
            description: getDescription(code),
            temp,
            location: locationName,
          })
        } catch {
          setWeather({ type: "sunny", description: "Clear sky", temp: null, location: null })
        }
      },
      () => setWeather({ type: "sunny", description: "Clear sky", temp: null, location: null }),
      { timeout: 8000 }
    )
  }, [])

  // Preload photo
  useEffect(() => {
    if (weather.type === "loading") return
    setPhotoLoaded(false)
    const img = new Image()
    img.src = PHOTOS[weather.type]
    img.onload = () => setPhotoLoaded(true)
    img.onerror = () => setPhotoLoaded(true)
  }, [weather.type])

  const photoUrl = PHOTOS[weather.type]
  const overlay = OVERLAYS[weather.type]

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Photo background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${photoUrl})`,
          opacity: photoLoaded ? 1 : 0,
          transition: "opacity 1.2s ease, background-image 0.5s ease",
          filter: weather.type === "thunderstorm" ? "saturate(0.7) brightness(0.75)" : "none",
          transform: "scale(1.03)",
        }}
      />

      {/* Fallback colour while photo loads */}
      <div
        className="fixed inset-0"
        style={{
          background:
            weather.type === "night" ? "#0a0e1a" :
            weather.type === "thunderstorm" ? "#111827" :
            weather.type === "rainy" ? "#1e2d3d" :
            "#6aadcf",
          opacity: photoLoaded ? 0 : 1,
          transition: "opacity 1.2s ease",
        }}
      />

      {/* Gradient overlay for readability */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: overlay, transition: "background 1.2s ease" }}
      />

      {/* Weather-specific particle layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {(weather.type === "rainy") && <RainCanvas heavy={false} />}
        {weather.type === "thunderstorm" && (
          <>
            <RainCanvas heavy />
            <LightningFlash />
          </>
        )}
        {weather.type === "snowy" && <SnowCanvas />}
        {weather.type === "foggy" && <FogLayer />}
      </div>

      {/* Weather badge */}
      {weather.type !== "loading" && weather.description && (
        <div className="fixed bottom-6 right-6 z-20 pointer-events-none">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-medium"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          >
            <span className="opacity-60 text-xs uppercase tracking-widest">
              {weather.location ?? "Weather"}
            </span>
            <span className="opacity-30">·</span>
            {weather.temp !== null && (
              <>
                <span className="text-base font-semibold">{weather.temp}°C</span>
                <span className="opacity-30">·</span>
              </>
            )}
            <span className="opacity-80">{weather.description}</span>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
