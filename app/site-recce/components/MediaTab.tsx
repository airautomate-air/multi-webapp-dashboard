// app/site-recce/components/MediaTab.tsx
"use client"

import { useRef, useState } from "react"
import { SiteEntry, MediaFile } from "../types"
import { upsertSite } from "../storage"
import { Camera, Video, FolderOpen, Loader2, AlertCircle } from "lucide-react"

interface Props {
  site: SiteEntry
  onUpdate: (site: SiteEntry) => void
}

export default function MediaTab({ site, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      if (file.size > 100 * 1024 * 1024) {
        alert(`${file.name} exceeds 100MB limit and was skipped.`)
        continue
      }
      await uploadFile(file)
    }
  }

  async function uploadFile(file: File) {
    const localId = crypto.randomUUID()
    const pending: MediaFile = {
      localId, driveFileId: null, driveUrl: null,
      type: file.type.startsWith("video") ? "video" : "photo",
      status: "pending", uploadedAt: null,
    }

    const updatedSite = { ...site, mediaFiles: [...site.mediaFiles, pending], updatedAt: new Date().toISOString() }
    onUpdate(updatedSite)
    upsertSite(updatedSite)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("siteId", site.id)
      fd.append("siteName", site.name)
      fd.append("fileName", `${pending.type}-${Date.now()}-${file.name}`)

      const res = await fetch("/api/site-recce/upload-media", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const done = { ...pending, driveFileId: data.driveFileId, driveUrl: data.driveUrl, status: "uploaded" as const, uploadedAt: new Date().toISOString() }
      const finalSite = {
        ...updatedSite,
        mediaFiles: updatedSite.mediaFiles.map(m => m.localId === localId ? done : m),
        updatedAt: new Date().toISOString(),
      }
      onUpdate(finalSite)
      upsertSite(finalSite)
    } catch {
      const errFile = { ...pending, status: "error" as const }
      const errSite = {
        ...updatedSite,
        mediaFiles: updatedSite.mediaFiles.map(m => m.localId === localId ? errFile : m),
      }
      onUpdate(errSite)
      upsertSite(errSite)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {site.mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {site.mediaFiles.map(m => (
            <div key={m.localId} className="relative aspect-square rounded-lg bg-stone-100 overflow-hidden">
              {m.status === "pending" && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                  <Loader2 size={20} className="animate-spin text-stone-400" />
                </div>
              )}
              {m.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 gap-1">
                  <AlertCircle size={20} className="text-red-400" />
                  <span className="text-[10px] text-red-400">Failed</span>
                </div>
              )}
              {m.status === "uploaded" && m.driveUrl && (
                <a href={m.driveUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center text-3xl">
                  {m.type === "video" ? "🎬" : "🖼️"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => photoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-900 text-white text-xs py-2.5 rounded-lg">
          <Camera size={14} /> Photo
        </button>
        <button onClick={() => videoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-700 text-white text-xs py-2.5 rounded-lg">
          <Video size={14} /> Video
        </button>
        <button onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-700 text-xs py-2.5 rounded-lg">
          <FolderOpen size={14} /> Gallery
        </button>
      </div>

      {/* @ts-ignore - capture attribute not fully typed for input elements */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
      {/* @ts-ignore - capture attribute not fully typed for input elements */}
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />

      {site.mediaFiles.length === 0 && (
        <p className="text-xs text-stone-400 text-center">No media yet. Take photos or add from your gallery.</p>
      )}
    </div>
  )
}
