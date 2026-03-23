export interface MediaFile {
  localId: string
  driveFileId: string | null
  driveUrl: string | null
  type: "photo" | "video"
  status: "pending" | "uploaded" | "error"
  uploadedAt: string | null
}

export interface SiteEntry {
  id: string
  createdAt: string
  updatedAt: string

  // Step 1 — Land & Physical
  name: string
  address: string
  lat: number | null
  lng: number | null
  areaSqm: number | null
  shapeFrontage: string
  terrain: "flat" | "slope" | "uneven" | ""
  floodRisk: "none" | "low" | "high" | ""
  landNotes: string

  // Step 2 — Legal & Planning
  titleType: "red_book" | "pink_book" | "no_title" | ""
  zoning: "residential" | "commercial" | "mixed" | "agricultural" | ""
  ownershipStatus: "clear" | "disputed" | "unknown" | ""
  permitStatus: "approved" | "pending" | "none" | ""
  legalNotes: string

  // Step 3 — Surroundings
  roadAccess: "main_road" | "side_street" | "alley" | ""
  nearbyAmenities: string[]
  competition: string
  areaVibe: "quiet" | "busy" | "up_and_coming" | "declining" | ""
  surroundingsNotes: string

  // Step 4 — Financials
  askingPriceVnd: number | null
  estDevelopmentCostVnd: number | null
  rating: 1 | 2 | 3 | 4 | 5 | null
  financialNotes: string

  // Media
  mediaFiles: MediaFile[]

  // Persistence state
  savedToSheets: boolean
  sheetsUrl: string | null
  pdfDriveUrl: string | null
}

export const AMENITY_OPTIONS = [
  "school", "hospital", "mall", "market", "park", "transport"
] as const

export function createEmptySite(): SiteEntry {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    name: "", address: "", lat: null, lng: null,
    areaSqm: null, shapeFrontage: "",
    terrain: "", floodRisk: "", landNotes: "",
    titleType: "", zoning: "", ownershipStatus: "", permitStatus: "", legalNotes: "",
    roadAccess: "", nearbyAmenities: [], competition: "", areaVibe: "", surroundingsNotes: "",
    askingPriceVnd: null, estDevelopmentCostVnd: null, rating: null, financialNotes: "",
    mediaFiles: [],
    savedToSheets: false, sheetsUrl: null, pdfDriveUrl: null,
  }
}
