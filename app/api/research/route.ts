import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { researchTopic } from "@/lib/gemini"
import { uploadFileToDrive } from "@/lib/drive"
import jsPDF from "jspdf"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { topic } = await request.json()
    if (!topic?.trim()) {
      return NextResponse.json({ error: "No topic provided" }, { status: 400 })
    }

    // Generate research summary with Gemini
    const research = await researchTopic(topic)

    // Generate PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    let y = 20

    // Title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    const titleLines = doc.splitTextToSize(research.title, maxWidth)
    doc.text(titleLines, margin, y)
    y += titleLines.length * 8 + 6

    // Date
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Research Summary · ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      margin,
      y
    )
    y += 10

    // Divider
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // Introduction
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text("Introduction", margin, y)
    y += 7

    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    const introLines = doc.splitTextToSize(research.introduction, maxWidth)
    doc.text(introLines, margin, y)
    y += introLines.length * 6 + 8

    // Key Findings
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text("Key Findings", margin, y)
    y += 7

    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    research.keyFindings.forEach((finding) => {
      const lines = doc.splitTextToSize(`• ${finding}`, maxWidth - 5)
      if (y + lines.length * 6 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = 20
      }
      doc.text(lines, margin + 3, y)
      y += lines.length * 6 + 3
    })
    y += 5

    // Analysis
    if (y + 40 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 20
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text("Analysis", margin, y)
    y += 7

    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    const analysisLines = doc.splitTextToSize(research.analysis, maxWidth)
    analysisLines.forEach((line: string) => {
      if (y + 6 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = 20
      }
      doc.text(line, margin, y)
      y += 6
    })
    y += 8

    // Conclusion
    if (y + 30 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 20
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text("Conclusion", margin, y)
    y += 7

    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    const conclusionLines = doc.splitTextToSize(research.conclusion, maxWidth)
    doc.text(conclusionLines, margin, y)

    const pdfArrayBuffer = doc.output("arraybuffer")
    const pdfBuffer = Buffer.from(pdfArrayBuffer)
    const fileName = `research-${topic.slice(0, 30).replace(/\s+/g, "-")}-${Date.now()}.pdf`

    // Upload to Google Drive
    const driveLink = await uploadFileToDrive(
      session.accessToken,
      fileName,
      "application/pdf",
      pdfBuffer
    )

    return NextResponse.json({
      research,
      pdfBase64: pdfBuffer.toString("base64"),
      driveLink,
      fileName,
    })
  } catch (error) {
    console.error("Research error:", error)
    return NextResponse.json(
      { error: "Failed to generate research" },
      { status: 500 }
    )
  }
}
