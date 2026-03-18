import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { extractTextFromImages } from "@/lib/gemini"
import { uploadFileToDrive } from "@/lib/drive"
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("images") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }

    // Convert files to base64
    const images = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        return {
          base64: buffer.toString("base64"),
          mimeType: file.type || "image/jpeg",
        }
      })
    )

    // Extract text with Gemini Vision
    const extractedText = await extractTextFromImages(images)

    // Generate .docx
    const timestamp = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Extracted Text",
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${timestamp}`,
                  italics: true,
                  color: "888888",
                }),
              ],
            }),
            new Paragraph({ text: "" }),
            ...extractedText.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line })],
                })
            ),
          ],
        },
      ],
    })

    const docBuffer = await Packer.toBuffer(doc)
    const fileName = `ocr-extract-${Date.now()}.docx`

    // Upload to Google Drive
    const driveLink = await uploadFileToDrive(
      session.accessToken,
      fileName,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docBuffer
    )

    return NextResponse.json({
      text: extractedText,
      docxBase64: docBuffer.toString("base64"),
      driveLink,
      fileName,
    })
  } catch (error) {
    console.error("OCR error:", error)
    return NextResponse.json(
      { error: "Failed to process images" },
      { status: 500 }
    )
  }
}
