import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { auth } from "@/lib/auth"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const audio = formData.get("audio")
  if (!audio || typeof audio === "string") {
    return NextResponse.json({ error: "No audio" }, { status: 400 })
  }

  const arrayBuffer = await (audio as Blob).arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const mimeType = (audio as Blob).type || "audio/webm"

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: "Transcribe this audio exactly as spoken. Return only the spoken words, no extra punctuation or commentary." },
        ],
      }],
    })
    return NextResponse.json({ text: result.text?.trim() ?? "" })
  } catch (err) {
    console.error("Site recce transcribe error:", err)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
