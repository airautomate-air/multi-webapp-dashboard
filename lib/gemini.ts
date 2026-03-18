import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function extractTextFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const parts = [
    {
      text: "Extract all text from the following image(s). Return only the text content, preserving the original layout and formatting as much as possible. If there are multiple images, separate the content from each with a line like '--- Image N ---'.",
    },
    ...images.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    })),
  ]

  const result = await model.generateContent(parts)
  return result.response.text()
}

export async function researchTopic(topic: string): Promise<{
  title: string
  introduction: string
  keyFindings: string[]
  analysis: string
  conclusion: string
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

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

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()

  return JSON.parse(cleaned)
}
