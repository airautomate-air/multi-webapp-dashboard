import { NextResponse } from "next/server"

const ZENQUOTES_URL = "https://zenquotes.io/api/quotes"

const FALLBACK_QUOTES = [
  { q: "Breathe. This too shall pass.", a: "Unknown" },
  { q: "You are enough, exactly as you are.", a: "Unknown" },
  { q: "The present moment always will have been.", a: "Marcus Aurelius" },
]

export async function GET() {
  try {
    const res = await fetch(ZENQUOTES_URL, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(FALLBACK_QUOTES)
    }

    const data = await res.json()

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(FALLBACK_QUOTES)
    }

    const quotes = data.filter(
      (item: unknown): item is { q: string; a: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { q: unknown }).q === "string" &&
        typeof (item as { a: unknown }).a === "string"
    )

    return NextResponse.json(quotes.length > 0 ? quotes : FALLBACK_QUOTES)
  } catch {
    return NextResponse.json(FALLBACK_QUOTES)
  }
}
