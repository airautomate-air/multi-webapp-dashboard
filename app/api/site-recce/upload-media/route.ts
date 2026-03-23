// app/api/site-recce/upload-media/route.ts
import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"
import { auth } from "@/lib/auth"

// App Router: disable Next.js body parsing so we can handle the raw stream.
// Body size is controlled by next.config.js — add this if not already present:
//   experimental: { serverActions: { bodySizeLimit: "100mb" } }
// or set api.bodyParser.sizeLimit in next.config.js for the /api/* routes.
export const runtime = "nodejs"

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'")
  const parentQuery = parentId ? ` and '${parentId}' in parents` : ""
  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQuery}`,
    fields: "files(id)",
  })
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  })
  return folder.data.id!
}

export async function getOrCreateSiteDriveFolder(
  drive: ReturnType<typeof google.drive>,
  siteName: string,
  siteId: string
): Promise<string> {
  const rootId = await getOrCreateFolder(drive, "SiteRecce")
  const folderName = `${siteName}-${siteId.slice(0, 6)}`
  return getOrCreateFolder(drive, folderName, rootId)
}

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

  const file = formData.get("file") as Blob | null
  const siteId = formData.get("siteId") as string
  const siteName = formData.get("siteName") as string
  const fileName = formData.get("fileName") as string

  if (!file || !siteId || !siteName || !fileName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  // Warn on large files (100MB soft cap)
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 100MB limit" }, { status: 413 })
  }

  try {
    const gauth = new google.auth.OAuth2()
    gauth.setCredentials({ access_token: session.accessToken as string })
    const drive = google.drive({ version: "v3", auth: gauth })

    const folderId = await getOrCreateSiteDriveFolder(drive, siteName, siteId)
    const buffer = Buffer.from(await file.arrayBuffer())
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: file.type, body: stream },
      fields: "id,webViewLink",
    })

    await drive.permissions.create({
      fileId: uploaded.data.id!,
      requestBody: { role: "reader", type: "anyone" },
    })

    return NextResponse.json({
      driveFileId: uploaded.data.id,
      driveUrl: uploaded.data.webViewLink,
    })
  } catch (err) {
    console.error("Site recce upload error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
