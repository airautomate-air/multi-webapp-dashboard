// app/api/site-recce/save/route.ts
import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { auth } from "@/lib/auth"
import { SiteEntry } from "@/app/site-recce/types"

async function getOrCreateSiteRecceSheet(
  sheets: ReturnType<typeof google.sheets>,
  drive: ReturnType<typeof google.drive>
): Promise<string> {
  const res = await drive.files.list({
    q: "name='Site Recce' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: "files(id)",
  })
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!

  const headers = [
    "id","Created","Updated","Site Name","Address","Lat","Lng","Area (m²)",
    "Shape/Frontage","Terrain","Flood Risk","Land Notes",
    "Title Type","Zoning","Ownership","Permit Status","Legal Notes",
    "Road Access","Amenities","Competition","Area Vibe","Surroundings Notes",
    "Asking Price (VND)","Price/m² (VND)","Est Dev Cost (VND)","Rating","Financial Notes",
    "Media URLs","PDF Report URL"
  ]

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Site Recce" },
      sheets: [{
        properties: { title: "Site Recce" },
        data: [{ rowData: [{ values: headers.map(h => ({ userEnteredValue: { stringValue: h } })) }] }],
      }],
    },
  })
  return spreadsheet.data.spreadsheetId!
}

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

  try {
    const gauth = new google.auth.OAuth2()
    gauth.setCredentials({ access_token: session.accessToken as string })
    const sheets = google.sheets({ version: "v4", auth: gauth })
    const drive = google.drive({ version: "v3", auth: gauth })

    const spreadsheetId = await getOrCreateSiteRecceSheet(sheets, drive)

    const pricePerSqm = site.askingPriceVnd && site.areaSqm
      ? Math.round(site.askingPriceVnd / site.areaSqm)
      : ""
    const mediaUrls = site.mediaFiles
      .filter(f => f.driveUrl)
      .map(f => f.driveUrl)
      .join(", ")

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Site Recce!A:AC",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          site.id, site.createdAt, site.updatedAt, site.name, site.address,
          site.lat ?? "", site.lng ?? "", site.areaSqm ?? "",
          site.shapeFrontage, site.terrain, site.floodRisk, site.landNotes,
          site.titleType, site.zoning, site.ownershipStatus, site.permitStatus, site.legalNotes,
          site.roadAccess, site.nearbyAmenities.join(", "), site.competition, site.areaVibe, site.surroundingsNotes,
          site.askingPriceVnd ?? "", pricePerSqm, site.estDevelopmentCostVnd ?? "",
          site.rating ?? "", site.financialNotes,
          mediaUrls, site.pdfDriveUrl ?? "",
        ]],
      },
    })

    const sheetsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    return NextResponse.json({ sheetsUrl })
  } catch (err) {
    console.error("Site recce save error:", err)
    return NextResponse.json({ error: "Failed to save to Sheets" }, { status: 500 })
  }
}
