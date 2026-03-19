// app/api/positive-vibes/chat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { auth } from "@/lib/auth"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const COACH_PERSONA = `You are a warm, mindful coach. Your role is to listen, encourage, and help the user gently reframe negative thinking. You do not give advice unless asked. You reflect back what you hear, ask gentle clarifying questions, and hold space for the user's feelings. Your tone is calm, grounded, and compassionate — like a trusted friend who also happens to have deep wisdom. Never be dismissive. Never rush to fix. Let the user feel heard first.

Begin each conversation by acknowledging the quote of the day if the user references it, but do not force it.`

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let messages: unknown
    try {
      const body = await request.json()
      messages = body?.messages
    } catch {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    const isValidMessage = (m: unknown): m is { role: "user" | "model"; content: string } =>
      typeof m === "object" &&
      m !== null &&
      ((m as { role: unknown }).role === "user" || (m as { role: unknown }).role === "model") &&
      typeof (m as { content: unknown }).content === "string"

    if (!messages.every(isValidMessage)) {
      return NextResponse.json({ error: "invalid messages format" }, { status: 400 })
    }

    const contents = messages.map((m: { role: "user" | "model"; content: string }) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { systemInstruction: COACH_PERSONA },
      contents,
    })

    const reply = response.text ?? ""
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    console.error("Positive Vibes chat error:", err)
    const message = err instanceof Error ? err.message : "Something went wrong"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
