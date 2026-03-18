import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { transcribeAudio } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { audioBase64, mimeType } = await request.json()
    if (!audioBase64) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 })
    }

    const transcript = await transcribeAudio(audioBase64, mimeType || "audio/webm")
    return NextResponse.json({ transcript })
  } catch (error) {
    console.error("Transcribe error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to transcribe audio", detail: message },
      { status: 500 }
    )
  }
}
