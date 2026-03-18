import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildFullPrompt } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { platform, shortPrompt, qa } = await request.json()
    if (!platform || !shortPrompt || !qa) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const builtPrompt = await buildFullPrompt(platform, shortPrompt, qa)
    return NextResponse.json({ prompt: builtPrompt })
  } catch (error) {
    console.error("Build prompt error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "Failed to build prompt", detail: message }, { status: 500 })
  }
}
