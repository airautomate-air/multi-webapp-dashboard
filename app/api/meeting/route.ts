import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { summarizeMeeting } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { transcript } = await request.json()
    if (!transcript?.trim()) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 })
    }

    const result = await summarizeMeeting(transcript)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Meeting summarize error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to summarize meeting", detail: message },
      { status: 500 }
    )
  }
}
