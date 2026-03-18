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

export async function generateClarifyingQuestions(
  platform: string,
  shortPrompt: string
): Promise<{ question: string; placeholder: string }[]> {
  const prompt = `You are an expert prompt engineer specializing in crafting optimized prompts for AI platforms.

The user wants to create a prompt for: "${platform}"
Their initial idea: "${shortPrompt}"

Generate 4 concise clarifying questions that will help you build a much better, more specific prompt for this platform.
Tailor your questions based on what "${platform}" is best at (e.g. for image/video tools ask about style, mood, resolution; for text AI ask about tone, audience, format; for coding AI ask about language, constraints).

Respond ONLY with a valid JSON array:
[
  { "question": "Question text?", "placeholder": "Example answer hint" },
  { "question": "Question text?", "placeholder": "Example answer hint" },
  { "question": "Question text?", "placeholder": "Example answer hint" },
  { "question": "Question text?", "placeholder": "Example answer hint" }
]

Do not include any text outside the JSON.`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })

  const text = (response.text ?? "").trim()
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
  return JSON.parse(cleaned)
}

export async function buildFullPrompt(
  platform: string,
  shortPrompt: string,
  qa: { question: string; answer: string }[]
): Promise<string> {
  const answersText = qa
    .filter((q) => q.answer.trim())
    .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
    .join("\n\n")

  const prompt = `You are an expert prompt engineer. Build a highly optimized, ready-to-use prompt for "${platform}".

User's original idea: "${shortPrompt}"

Additional context from clarifying questions:
${answersText}

Instructions:
- Write the prompt AS IF the user will paste it directly into ${platform}
- Optimize the structure, wording, and format specifically for how ${platform} works best
- For image/video platforms (Midjourney, Kling, Runway, Stable Diffusion): use descriptive visual language, style references, technical parameters
- For text AI (Claude, ChatGPT, Gemini): use clear instructions, role setting, output format specification
- For coding AI: include language, constraints, expected output format
- Make it detailed, specific, and immediately usable
- Do NOT add any explanation or preamble — output ONLY the prompt itself, nothing else`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })

  return (response.text ?? "").trim()
}
