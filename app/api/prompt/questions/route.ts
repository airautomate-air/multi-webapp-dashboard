import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateClarifyingQuestions } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { platform, shortPrompt } = await request.json()
    if (!platform || !shortPrompt?.trim()) {
      return NextResponse.json({ error: "Platform and prompt are required" }, { status: 400 })
    }

    const questions = await generateClarifyingQuestions(platform, shortPrompt)
    return NextResponse.json({ questions })
  } catch (error) {
    console.error("Questions error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "Failed to generate questions", detail: message }, { status: 500 })
  }
}
