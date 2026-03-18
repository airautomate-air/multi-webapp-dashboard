import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { saveMeetingToSheets } from "@/lib/sheets"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { title, summary, tasks, transcript } = await request.json()
    if (!summary) {
      return NextResponse.json({ error: "No meeting data provided" }, { status: 400 })
    }

    const sheetsLink = await saveMeetingToSheets(session.accessToken, {
      title,
      summary,
      tasks,
      transcript,
    })

    return NextResponse.json({ sheetsLink })
  } catch (error) {
    console.error("Sheets save error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to save to Google Sheets", detail: message },
      { status: 500 }
    )
  }
}
