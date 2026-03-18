import { google } from "googleapis"

async function getOrCreateMeetingSheet(
  sheets: ReturnType<typeof google.sheets>,
  drive: ReturnType<typeof google.drive>
): Promise<string> {
  // Search for existing spreadsheet
  const res = await drive.files.list({
    q: "name='Meeting Notes' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: "files(id)",
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // Create new spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Meeting Notes" },
      sheets: [
        {
          properties: { title: "Meetings" },
          data: [
            {
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Date" } },
                    { userEnteredValue: { stringValue: "Title" } },
                    { userEnteredValue: { stringValue: "Summary" } },
                    { userEnteredValue: { stringValue: "Tasks" } },
                    { userEnteredValue: { stringValue: "Transcript" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  })

  return spreadsheet.data.spreadsheetId!
}

export async function saveMeetingToSheets(
  accessToken: string,
  meeting: {
    title: string
    summary: string
    tasks: string[]
    transcript: string
  }
): Promise<string> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const sheets = google.sheets({ version: "v4", auth })
  const drive = google.drive({ version: "v3", auth })

  const spreadsheetId = await getOrCreateMeetingSheet(sheets, drive)

  const date = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Meetings!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          date,
          meeting.title,
          meeting.summary,
          meeting.tasks.join("\n"),
          meeting.transcript,
        ],
      ],
    },
  })

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
}
