import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ patterns: [] }, { status: 401 })
    }

    const { mentorReply } = await request.json()

    if (!mentorReply) {
      return NextResponse.json({ patterns: [] })
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "You extract behavioral patterns from mentor feedback. Return ONLY a JSON array of strings. Each string is a concise behavioral pattern (10 words max) that the mentor explicitly identified about the user — e.g. 'Avoids discussing distribution', 'Over-engineers early solutions'. If no patterns are explicitly called out, return an empty array [].",
      messages: [
        {
          role: "user",
          content: `Extract behavioral patterns from this mentor feedback:\n\n${mentorReply}`,
        },
      ],
    })

    const firstBlock = response.content[0]
    const text = firstBlock?.type === "text" ? firstBlock.text.trim() : "[]"

    let patterns: string[] = []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        patterns = parsed.filter((p): p is string => typeof p === "string")
      }
    } catch {
      patterns = []
    }

    return NextResponse.json({ patterns })
  } catch (err: unknown) {
    console.error("Pattern extraction error:", err)
    // Silent failure — never break the chat
    return NextResponse.json({ patterns: [] })
  }
}
