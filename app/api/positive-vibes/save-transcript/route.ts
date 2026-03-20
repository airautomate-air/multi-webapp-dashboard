// app/api/positive-vibes/save-transcript/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

interface TranscriptMessage {
  role: "user" | "model"
  content: string
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let messages: TranscriptMessage[]
  try {
    const body = await request.json()
    messages = body?.messages
    if (!Array.isArray(messages)) throw new Error("invalid")
  } catch {
    return NextResponse.json({ error: "invalid transcript format" }, { status: 400 })
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "transcript is empty" }, { status: 400 })
  }

  // Step 1: create blank doc
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: `Positive Vibes – ${new Date().toLocaleDateString()}` }),
  })

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    console.error("Docs create error:", err)
    return NextResponse.json({ error: "Failed to create document" }, { status: 502 })
  }

  const doc = await createRes.json()
  const docId: string = doc.documentId

  // Step 2: insert transcript text
  const transcript = messages
    .map((m) => `${m.role === "user" ? "You" : "Coach"}: ${m.content}`)
    .join("\n\n")

  const batchRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          { insertText: { location: { index: 1 }, text: transcript } },
        ],
      }),
    }
  )

  if (!batchRes.ok) {
    const err = await batchRes.json().catch(() => ({}))
    console.error("Docs batchUpdate error:", err)
    return NextResponse.json({ error: "Failed to write transcript" }, { status: 502 })
  }

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`
  return NextResponse.json({ url: docUrl })
}
