// app/site-recce/components/MediaTab.tsx
"use client"

import { useRef } from "react"
import { SiteEntry, MediaFile } from "../types"
import { upsertSite } from "../storage"
import { Camera, Video, FolderOpen, Loader2, AlertCircle, X, RotateCcw } from "lucide-react"

interface Props {
  site: SiteEntry
  onUpdate: (site: SiteEntry) => void
}

export default function MediaTab({ site, onUpdate }: Props) {
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function removeThumbnail(localId: string) {
    const next = {
      ...site,
      mediaFiles: site.mediaFiles.filter(m => m.localId !== localId),
      updatedAt: new Date().toISOString(),
    }
    onUpdate(next)
    upsertSite(next)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      if (file.size > 100 * 1024 * 1024) {
        alert(`${file.name} exceeds 100MB limit and was skipped.`)
        continue
      }
      await uploadFile(file, crypto.randomUUID())
    }
  }

  async function retryUpload(failed: MediaFile) {
    // Reset to pending state, then trigger file picker for re-selection
    // Since we don't hold a File reference after upload attempt, open gallery picker
    // as the simplest retry path; alternatively ask user to re-select
    const input = document.createElement("input")
    input.type = "file"
    input.accept = failed.type === "video" ? "video/*" : "image/*"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 100 * 1024 * 1024) {
        alert(`${file.name} exceeds 100MB limit.`)
        return
      }
      // Remove the failed entry, upload fresh
      removeThumbnail(failed.localId)
      await uploadFile(file, crypto.randomUUID())
    }
    input.click()
  }

  async function uploadFile(file: File, localId: string) {
    const pending: MediaFile = {
      localId,
      driveFileId: null,
      driveUrl: null,
      type: file.type.startsWith("video") ? "video" : "photo",
      status: "pending",
      uploadedAt: null,
    }

    // Use functional update pattern via latest site snapshot from localStorage
    const currentSites = (() => {
      try { return JSON.parse(localStorage.getItem("site-recce-sites") ?? "[]") } catch { return [] }
    })()
    const currentSite: SiteEntry = currentSites.find((s: SiteEntry) => s.id === site.id) ?? site

    const withPending = {
      ...currentSite,
      mediaFiles: [...currentSite.mediaFiles, pending],
      updatedAt: new Date().toISOString(),
    }
    onUpdate(withPending)
    upsertSite(withPending)

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("siteId", site.id)
      fd.append("siteName", site.name)
      fd.append("fileName", `${pending.type}-${Date.now()}-${file.name}`)

      const res = await fetch("/api/site-recce/upload-media", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const done: MediaFile = {
        ...pending,
        driveFileId: data.driveFileId,
        driveUrl: data.driveUrl,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
      }

      const afterUpload = {
        ...withPending,
        mediaFiles: withPending.mediaFiles.map(m => m.localId === localId ? done : m),
        updatedAt: new Date().toISOString(),
      }
      onUpdate(afterUpload)
      upsertSite(afterUpload)
    } catch {
      const errFile: MediaFile = { ...pending, status: "error" }
      const errSite = {
        ...withPending,
        mediaFiles: withPending.mediaFiles.map(m => m.localId === localId ? errFile : m),
      }
      onUpdate(errSite)
      upsertSite(errSite)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {site.mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {site.mediaFiles.map(m => (
            <div key={m.localId} className="relative aspect-square rounded-lg bg-stone-100 overflow-hidden">
              {/* × remove button — always visible */}
              <button
                onClick={() => removeThumbnail(m.localId)}
                className="absolute top-1 right-1 z-10 w-5 h-5 bg-stone-900/70 hover:bg-stone-900 text-white rounded-full flex items-center justify-center"
                aria-label="Remove"
              >
                <X size={10} />
              </button>

              {m.status === "pending" && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                  <Loader2 size={20} className="animate-spin text-stone-400" />
                </div>
              )}

              {m.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 gap-1 px-1">
                  <AlertCircle size={16} className="text-red-400" />
                  <span className="text-[9px] text-red-400 text-center">Failed</span>
                  <button
                    onClick={() => retryUpload(m)}
                    className="flex items-center gap-0.5 text-[9px] text-red-600 hover:text-red-800 mt-0.5"
                  >
                    <RotateCcw size={9} /> Retry
                  </button>
                </div>
              )}

              {m.status === "uploaded" && m.driveUrl && (
                <a
                  href={m.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center text-3xl"
                >
                  {m.type === "video" ? "🎬" : "🖼️"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => photoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-900 text-white text-xs py-2.5 rounded-lg"
        >
          <Camera size={14} /> Photo
        </button>
        <button
          onClick={() => videoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-700 text-white text-xs py-2.5 rounded-lg"
        >
          <Video size={14} /> Video
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-700 text-xs py-2.5 rounded-lg"
        >
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
