// app/api/site-recce/export/route.ts
import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"
import { auth } from "@/lib/auth"
import { SiteEntry } from "@/app/site-recce/types"
import { getOrCreateSiteDriveFolder } from "@/app/api/site-recce/upload-media/route"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let site: SiteEntry
  try {
    site = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!site?.id || !Array.isArray(site?.mediaFiles)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    // Dynamic import to avoid SSR issues with jspdf
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF()
    const pricePerSqm = site.askingPriceVnd && site.areaSqm
      ? Math.round(site.askingPriceVnd / site.areaSqm).toLocaleString()
      : "N/A"

    let y = 20
    const line = (text: string, indent = 0) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(text, 10 + indent, y)
      y += 7
    }
    const section = (title: string) => {
      y += 3
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      line(title)
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
    }

    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    line(`Site Recce Report: ${site.name}`)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    line(`Address: ${site.address}`)
    if (site.lat && site.lng) line(`GPS: ${site.lat}, ${site.lng}`)
    line(`Date: ${new Date(site.createdAt).toLocaleDateString()}`)
    if (site.rating) line(`Rating: ${"★".repeat(site.rating)}${"☆".repeat(5 - site.rating)}`)

    section("Land & Physical")
    line(`Area: ${site.areaSqm ? site.areaSqm + " m²" : "N/A"}`, 5)
    line(`Shape/Frontage: ${site.shapeFrontage || "N/A"}`, 5)
    line(`Terrain: ${site.terrain || "N/A"}`, 5)
    line(`Flood Risk: ${site.floodRisk || "N/A"}`, 5)
    if (site.landNotes) line(`Notes: ${site.landNotes}`, 5)

    section("Legal & Planning")
    line(`Title: ${site.titleType || "N/A"}`, 5)
    line(`Zoning: ${site.zoning || "N/A"}`, 5)
    line(`Ownership: ${site.ownershipStatus || "N/A"}`, 5)
    line(`Permit: ${site.permitStatus || "N/A"}`, 5)
    if (site.legalNotes) line(`Notes: ${site.legalNotes}`, 5)

    section("Surroundings")
    line(`Road Access: ${site.roadAccess || "N/A"}`, 5)
    line(`Amenities: ${site.nearbyAmenities.join(", ") || "N/A"}`, 5)
    line(`Competition: ${site.competition || "N/A"}`, 5)
    line(`Area Vibe: ${site.areaVibe || "N/A"}`, 5)
    if (site.surroundingsNotes) line(`Notes: ${site.surroundingsNotes}`, 5)

    section("Financials")
    line(`Asking Price: ${site.askingPriceVnd ? site.askingPriceVnd.toLocaleString() + " VND" : "N/A"}`, 5)
    line(`Price/m²: ${pricePerSqm !== "N/A" ? pricePerSqm + " VND" : "N/A"}`, 5)
    line(`Est. Dev Cost: ${site.estDevelopmentCostVnd ? site.estDevelopmentCostVnd.toLocaleString() + " VND" : "N/A"}`, 5)
    if (site.financialNotes) line(`Notes: ${site.financialNotes}`, 5)

    const uploadedMedia = site.mediaFiles.filter(f => f.driveUrl)
    if (uploadedMedia.length > 0) {
      section("Media Files")
      uploadedMedia.forEach((m, i) => line(`${i + 1}. [${m.type}] ${m.driveUrl}`, 5))
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer") as ArrayBuffer)

    const gauth = new google.auth.OAuth2()
    gauth.setCredentials({ access_token: session.accessToken as string })
    const drive = google.drive({ version: "v3", auth: gauth })

    const folderId = await getOrCreateSiteDriveFolder(drive, site.name, site.id)
    const stream = new Readable()
    stream.push(pdfBuffer)
    stream.push(null)

    const uploaded = await drive.files.create({
      requestBody: { name: "report.pdf", parents: [folderId] },
      media: { mimeType: "application/pdf", body: stream },
      fields: "id,webViewLink",
    })
    await drive.permissions.create({
      fileId: uploaded.data.id!,
      requestBody: { role: "reader", type: "anyone" },
    })

    return NextResponse.json({ pdfDriveUrl: uploaded.data.webViewLink })
  } catch (err) {
    console.error("Site recce export error:", err)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
