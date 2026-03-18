import { google } from "googleapis"
import { Readable } from "stream"

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string
): Promise<string> {
  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  })

  return folder.data.id!
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: "v3", auth })

  const folderId = await getOrCreateFolder(drive, "Dashboard Apps")

  const stream = new Readable()
  stream.push(buffer)
  stream.push(null)

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,webViewLink",
  })

  await drive.permissions.create({
    fileId: file.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  })

  return file.data.webViewLink || ""
}
