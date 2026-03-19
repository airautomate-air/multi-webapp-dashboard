"use client"

import { useEffect, useState, useMemo } from "react"

type WeatherType = "sunny" | "cloudy" | "rainy" | "thunderstorm" | "snowy" | "night" | "foggy" | "loading"

interface WeatherInfo {
  type: WeatherType
  description: string
  temp: number | null
  location: string | null
}

function getWeatherType(code: number, isNight: boolean): WeatherType {
  if (isNight && code === 0) return "night"
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
  if (code >= 61 && code <= 67) return "Rainy"
  if (code >= 71 && code <= 77) return "Snowing"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code >= 85 && code <= 86) return "Snow showers"
  if (code === 95) return "Thunderstorm"
  if (code >= 96) return "Thunderstorm with hail"
  return "Cloudy"
}

// ── Rain drops ──────────────────────────────────────────────────────────────
function RainDrops({ heavy = false }: { heavy?: boolean }) {
  const drops = useMemo(() =>
    Array.from({ length: heavy ? 120 : 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 0.4 + Math.random() * 0.6,
      opacity: 0.3 + Math.random() * 0.5,
      width: heavy ? 1.5 + Math.random() : 1 + Math.random() * 0.5,
      height: heavy ? 18 + Math.random() * 12 : 12 + Math.random() * 8,
    })), [heavy])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute top-0 weather-rain-drop"
          style={{
            left: `${d.left}%`,
            width: `${d.width}px`,
            height: `${d.height}px`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            opacity: d.opacity,
            background: "linear-gradient(to bottom, transparent, rgba(174,214,241,0.8))",
            borderRadius: "0 0 2px 2px",
          }}
        />
      ))}
    </div>
  )
}

// ── Snow flakes ──────────────────────────────────────────────────────────────
function Snowflakes() {
  const flakes = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      size: 3 + Math.random() * 5,
      opacity: 0.4 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 60,
    })), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="absolute top-0 rounded-full weather-snow-flake"
          style={{
            left: `${f.left}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            "--drift": `${f.drift}px`,
            opacity: f.opacity,
            background: "white",
            boxShadow: "0 0 4px rgba(255,255,255,0.8)",
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

// ── Stars ────────────────────────────────────────────────────────────────────
function Stars() {
  const stars = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 70,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    })), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full weather-star-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            background: "white",
            boxShadow: "0 0 3px rgba(255,255,255,0.9)",
          }}
        />
      ))}
    </div>
  )
}

// ── Clouds ───────────────────────────────────────────────────────────────────
function Clouds({ dark = false }: { dark?: boolean }) {
  const clouds = useMemo(() => [
    { id: 1, top: 8, width: 200, duration: 60, delay: 0, opacity: dark ? 0.85 : 0.75 },
    { id: 2, top: 18, width: 280, duration: 80, delay: -20, opacity: dark ? 0.9 : 0.65 },
    { id: 3, top: 5, width: 160, duration: 50, delay: -35, opacity: dark ? 0.8 : 0.55 },
    { id: 4, top: 28, width: 240, duration: 90, delay: -10, opacity: dark ? 0.95 : 0.7 },
    { id: 5, top: 15, width: 180, duration: 70, delay: -45, opacity: dark ? 0.85 : 0.6 },
  ], [dark])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute weather-cloud-drift"
          style={{
            top: `${c.top}%`,
            width: `${c.width}px`,
            height: `${c.width * 0.4}px`,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            opacity: c.opacity,
          }}
        >
          <svg viewBox="0 0 200 80" fill={dark ? "#4a5568" : "#e2e8f0"}>
            <ellipse cx="100" cy="60" rx="95" ry="30" />
            <ellipse cx="70" cy="45" rx="55" ry="35" />
            <ellipse cx="130" cy="48" rx="50" ry="30" />
            <ellipse cx="100" cy="35" rx="45" ry="30" />
          </svg>
        </div>
      ))}
    </div>
  )
}

// ── Lightning ─────────────────────────────────────────────────────────────────
function Lightning() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 weather-lightning" />
      <svg
        className="absolute weather-lightning-bolt"
        style={{ left: "30%", top: "10%", width: 80, height: 200 }}
        viewBox="0 0 80 200"
      >
        <polyline
          points="50,0 20,90 45,90 10,200 70,80 42,80 65,0"
          fill="rgba(255,255,180,0.9)"
          stroke="rgba(255,255,100,0.7)"
          strokeWidth="2"
        />
      </svg>
      <svg
        className="absolute weather-lightning-bolt-2"
        style={{ left: "65%", top: "5%", width: 60, height: 160 }}
        viewBox="0 0 60 160"
      >
        <polyline
          points="38,0 15,70 35,70 8,160 55,65 32,65 50,0"
          fill="rgba(255,255,180,0.85)"
          stroke="rgba(255,255,100,0.6)"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

// ── Sun ───────────────────────────────────────────────────────────────────────
function Sun() {
  return (
    <div className="absolute pointer-events-none" style={{ top: "6%", right: "12%" }}>
      {/* glow */}
      <div
        className="absolute rounded-full weather-sun-pulse"
        style={{
          width: 140, height: 140,
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(253,224,71,0.4) 0%, transparent 70%)",
        }}
      />
      {/* rays */}
      <div className="absolute weather-sun-rotate" style={{ width: 80, height: 80, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 3, height: 20,
              background: "rgba(253,224,71,0.6)",
              borderRadius: 2,
              top: "50%", left: "50%",
              transformOrigin: "50% 0%",
              transform: `translateX(-50%) rotate(${i * 30}deg) translateY(-42px)`,
            }}
          />
        ))}
      </div>
      {/* core */}
      <div
        className="relative rounded-full"
        style={{
          width: 64, height: 64,
          background: "radial-gradient(circle at 35% 35%, #fef08a, #fbbf24)",
          boxShadow: "0 0 30px rgba(251,191,36,0.6), 0 0 60px rgba(253,224,71,0.3)",
        }}
      />
    </div>
  )
}

// ── Scene configs ─────────────────────────────────────────────────────────────
const scenes: Record<WeatherType, { gradient: string; textColor: string }> = {
  sunny: {
    gradient: "linear-gradient(to bottom, #38bdf8 0%, #7dd3fc 40%, #e0f2fe 100%)",
    textColor: "text-sky-900",
  },
  cloudy: {
    gradient: "linear-gradient(to bottom, #64748b 0%, #94a3b8 40%, #cbd5e1 100%)",
    textColor: "text-slate-100",
  },
  rainy: {
    gradient: "linear-gradient(to bottom, #1e293b 0%, #334155 40%, #475569 100%)",
    textColor: "text-slate-100",
  },
  thunderstorm: {
    gradient: "linear-gradient(to bottom, #0f172a 0%, #1e293b 50%, #334155 100%)",
    textColor: "text-slate-100",
  },
  snowy: {
    gradient: "linear-gradient(to bottom, #bfdbfe 0%, #dbeafe 40%, #eff6ff 100%)",
    textColor: "text-blue-900",
  },
  night: {
    gradient: "linear-gradient(to bottom, #020617 0%, #0f172a 50%, #1e1b4b 100%)",
    textColor: "text-slate-100",
  },
  foggy: {
    gradient: "linear-gradient(to bottom, #9ca3af 0%, #d1d5db 40%, #f3f4f6 100%)",
    textColor: "text-gray-700",
  },
  loading: {
    gradient: "linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%)",
    textColor: "text-slate-400",
  },
}

// ── Main component ────────────────────────────────────────────────────────────
export function WeatherBackground({ children }: { children: React.ReactNode }) {
  const [weather, setWeather] = useState<WeatherInfo>({
    type: "loading",
    description: "Detecting weather…",
    temp: null,
    location: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather({ type: "sunny", description: "Clear sky", temp: null, location: null })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords

          // Reverse geocode for city name (free)
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

          // Weather from Open-Meteo (free, no key)
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
      () => {
        setWeather({ type: "sunny", description: "Clear sky", temp: null, location: null })
      },
      { timeout: 8000 }
    )
  }, [])

  const scene = scenes[weather.type]

  return (
    <div
      className="relative min-h-screen"
      style={{ background: scene.gradient, transition: "background 1.5s ease" }}
    >
      {/* Weather layers */}
      {weather.type === "sunny" && (
        <>
          <Sun />
          <Clouds dark={false} />
        </>
      )}
      {weather.type === "cloudy" && <Clouds dark />}
      {weather.type === "rainy" && (
        <>
          <Clouds dark />
          <RainDrops />
        </>
      )}
      {weather.type === "thunderstorm" && (
        <>
          <Clouds dark />
          <RainDrops heavy />
          <Lightning />
        </>
      )}
      {weather.type === "snowy" && (
        <>
          <Clouds />
          <Snowflakes />
        </>
      )}
      {weather.type === "night" && <Stars />}
      {weather.type === "foggy" && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(255,255,255,0.08) 80px, rgba(255,255,255,0.08) 81px)",
          animation: "fogDrift 20s linear infinite",
        }} />
      )}

      {/* Weather badge */}
      {weather.type !== "loading" && (
        <div className="absolute top-20 right-6 z-10 pointer-events-none">
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-2 text-right shadow-lg">
            <div className={`text-sm font-medium ${scene.textColor} opacity-90`}>
              {weather.location && <span>{weather.location} · </span>}
              {weather.temp !== null && <span>{weather.temp}°C · </span>}
              {weather.description}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
