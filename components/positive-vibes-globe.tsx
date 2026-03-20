// components/positive-vibes-globe.tsx
"use client"

import { useRef, useEffect, useCallback } from "react"

export interface GlobeProps {
  state: "idle" | "listening" | "speaking"
  audioLevel: number
  size?: number
}

interface Point {
  lat: number
  lon: number
  x: number
  y: number
  z: number
}

function buildPoints(n: number): Point[] {
  const golden = (1 + Math.sqrt(5)) / 2
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const lat = Math.acos(1 - (2 * (i + 0.5)) / n)
    const lon = (2 * Math.PI * i) / golden
    pts.push({
      lat, lon,
      x: Math.sin(lat) * Math.cos(lon),
      y: Math.cos(lat),
      z: Math.sin(lat) * Math.sin(lon),
    })
  }
  return pts
}

const BASE_POINTS = buildPoints(1800)

export default function PositiveVibesGlobe({ state, audioLevel, size = 340 }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rippleRef = useRef(0)
  const phaseRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  // Keep live values in refs so draw() never needs to close over changing props
  const stateRef = useRef(state)
  const audioLevelRef = useRef(audioLevel)
  const sizeRef = useRef(size)
  stateRef.current = state
  audioLevelRef.current = audioLevel
  sizeRef.current = size

  // Resize canvas (and reset context transform) only when size changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = sizeRef.current * dpr
    canvas.height = sizeRef.current * dpr
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0) // reset before scaling
      ctx.scale(dpr, dpr)
    }
  }, [size])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const s = stateRef.current
    const al = audioLevelRef.current
    const sz = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2
    const cy = h / 2
    const R = sz / 2 - 12

    // lerp ripple toward target
    const target =
      s === "speaking" ? al * 0.85 :
      s === "listening" ? 0.22 : 0
    rippleRef.current += (target - rippleRef.current) * 0.06
    const ripple = rippleRef.current
    phaseRef.current += 0.018

    ctx.clearRect(0, 0, w, h)

    // background glow
    const glowColor =
      s === "listening" ? "rgba(30,80,180,0.18)" :
      s === "speaking"  ? "rgba(200,170,0,0.18)" :
                          "rgba(60,140,80,0.15)"
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2)
    grd.addColorStop(0, glowColor)
    grd.addColorStop(1, "transparent")
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)

    const rot = phaseRef.current * 0.3
    const cosR = Math.cos(rot)
    const sinR = Math.sin(rot)

    const projected: Array<{ sx: number; sy: number; depth: number }> = []
    for (const p of BASE_POINTS) {
      const disp = ripple > 0.01
        ? Math.sin(p.lat * 5 + phaseRef.current) * Math.sin(p.lon * 3 + phaseRef.current * 0.7) * ripple
        : 0
      const r = 1 + disp

      const rx = p.x * cosR - p.z * sinR
      const ry = p.y
      const rz = p.x * sinR + p.z * cosR

      const depth = (rz + 1) / 2
      projected.push({ sx: cx + rx * R * r, sy: cy - ry * R * r, depth })
    }

    projected.sort((a, b) => a.depth - b.depth)

    for (const p of projected) {
      const d = p.depth
      const alpha = 0.25 + d * 0.75

      let rr: number, gg: number, bb: number
      if (s === "listening") {
        rr = Math.round(20 + d * 60)
        gg = Math.round(110 + d * 100)
        bb = Math.round(180 + d * 60)
      } else if (s === "speaking") {
        rr = Math.round(200 + d * 40)
        gg = Math.round(180 + d * 50)
        bb = Math.round(20 + d * 40)
      } else {
        rr = Math.round(60 + d * 80)
        gg = Math.round(160 + d * 60)
        bb = Math.round(80 + d * 60)
      }

      const radius = 0.2 + d * 1.1
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(2)})`
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(draw)
  }, []) // stable — reads live values via refs

  // Start/stop animation loop once (mount/unmount only)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="select-none"
    />
  )
}
