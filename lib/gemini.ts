import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function extractTextFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const contents = [
    {
      text: "Extract all text from the following image(s). Return only the text content, preserving the original layout and formatting as much as possible. If there are multiple images, separate the content from each with a line like '--- Image N ---'.",
    },
    ...images.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    })),
  ]

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: contents }],
  })

  return response.text ?? ""
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe all speech from this audio recording accurately. Return only the spoken words as plain text. If multiple speakers, separate their speech with a new line.",
          },
          { inlineData: { data: audioBase64, mimeType } },
        ],
      },
    ],
  })
  return response.text ?? ""
}

export async function summarizeMeeting(transcript: string): Promise<{
  title: string
  summary: string
  tasks: string[]
}> {
  const prompt = `You are a professional meeting assistant. Analyze the following meeting transcript and extract key information.

Respond ONLY with a valid JSON object in this exact structure:
{
  "title": "A concise meeting title based on the content",
  "summary": "A clear 2-3 paragraph summary of what was discussed",
  "tasks": ["Action item 1", "Action item 2", "Action item 3"]
}

The tasks array should contain specific, actionable items that were mentioned or implied in the meeting. If no tasks are found, return an empty array.

Do not include any text outside the JSON.

Transcript:
${transcript}`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })

  const text = (response.text ?? "").trim()
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
  return JSON.parse(cleaned)
}

export async function researchTopic(topic: string): Promise<{
  title: string
  introduction: string
  keyFindings: string[]
  analysis: string
  conclusion: string
}> {
  const prompt = `You are a research assistant. Conduct a thorough research summary on the following topic: "${topic}"

Respond ONLY with a valid JSON object in this exact structure:
{
  "title": "Formal research title",
  "introduction": "2-3 sentence introduction to the topic",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3", "Finding 4", "Finding 5"],
  "analysis": "2-3 paragraph analysis of the topic",
  "conclusion": "1-2 sentence conclusion"
}

Do not include any text outside the JSON.`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })

  const text = (response.text ?? "").trim()
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()

  return JSON.parse(cleaned)
}
