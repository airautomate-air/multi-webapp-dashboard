// app/site-recce/components/MediaTab.tsx
"use client"

import { useRef } from "react"
import { SiteEntry, MediaFile } from "../types"
import { loadSites, upsertSite } from "../storage"
import { Camera, Video, FolderOpen, Loader2, AlertCircle, X, RotateCcw } from "lucide-react"

interface Props {
  site: SiteEntry
  onUpdate: (site: SiteEntry) => void
}

// Reads the freshest version of a site from localStorage to avoid stale closures
function freshSite(siteId: string, fallback: SiteEntry): SiteEntry {
  return loadSites().find(s => s.id === siteId) ?? fallback
}

function applyToSite(
  siteId: SiteEntry["id"],
  fallback: SiteEntry,
  apply: (s: SiteEntry) => SiteEntry,
  onUpdate: (s: SiteEntry) => void
) {
  const current = freshSite(siteId, fallback)
  const next = apply(current)
  onUpdate(next)
  upsertSite(next)
}

export default function MediaTab({ site, onUpdate }: Props) {
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const retryRef = useRef<HTMLInputElement>(null)
  const retryTargetRef = useRef<MediaFile | null>(null)

  function removeThumbnail(localId: string) {
    applyToSite(site.id, site, s => ({
      ...s,
      mediaFiles: s.mediaFiles.filter(m => m.localId !== localId),
      updatedAt: new Date().toISOString(),
    }), onUpdate)
  }

  function triggerRetry(m: MediaFile) {
    retryTargetRef.current = m
    retryRef.current?.click()
  }

  async function handleRetryFile(files: FileList | null) {
    const target = retryTargetRef.current
    retryTargetRef.current = null
    if (!files || files.length === 0 || !target) return
    const file = files[0]
    if (file.size > 100 * 1024 * 1024) {
      alert(`${file.name} exceeds 100MB limit.`)
      return
    }
    // Remove the failed entry before re-uploading
    applyToSite(site.id, site, s => ({
      ...s,
      mediaFiles: s.mediaFiles.filter(m => m.localId !== target.localId),
      updatedAt: new Date().toISOString(),
    }), onUpdate)
    await uploadFile(file)
  }

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
      localId,
      driveFileId: null,
      driveUrl: null,
      type: file.type.startsWith("video") ? "video" : "photo",
      status: "pending",
      uploadedAt: null,
    }

    // Add pending entry using fresh localStorage snapshot
    applyToSite(site.id, site, s => ({
      ...s,
      mediaFiles: [...s.mediaFiles, pending],
      updatedAt: new Date().toISOString(),
    }), onUpdate)

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
      // Re-read fresh snapshot after async gap to avoid clobbering concurrent writes
      applyToSite(site.id, site, s => ({
        ...s,
        mediaFiles: s.mediaFiles.map(m => m.localId === localId ? done : m),
        updatedAt: new Date().toISOString(),
      }), onUpdate)
    } catch {
      const errFile: MediaFile = { ...pending, status: "error" }
      applyToSite(site.id, site, s => ({
        ...s,
        mediaFiles: s.mediaFiles.map(m => m.localId === localId ? errFile : m),
      }), onUpdate)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {site.mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {site.mediaFiles.map((m, index) => (
            <div key={m.localId} className="relative aspect-square rounded-lg bg-stone-100 overflow-hidden">
              {/* × remove button */}
              <button
                type="button"
                onClick={() => removeThumbnail(m.localId)}
                className="absolute top-1 right-1 z-10 w-5 h-5 bg-stone-900/70 hover:bg-stone-900 text-white rounded-full flex items-center justify-center"
                aria-label={`Remove ${m.type} ${index + 1}`}
              >
                <X size={10} aria-hidden="true" />
              </button>

              {m.status === "pending" && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                  <Loader2 size={20} className="animate-spin text-stone-400" aria-hidden="true" />
                </div>
              )}

              {m.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 gap-1 px-1">
                  <AlertCircle size={16} className="text-red-400" aria-hidden="true" />
                  <span className="text-[9px] text-red-400 text-center">Failed</span>
                  <button
                    type="button"
                    onClick={() => triggerRetry(m)}
                    className="flex items-center gap-0.5 text-[9px] text-red-600 hover:text-red-800 mt-0.5"
                    aria-label={`Retry upload for ${m.type} ${index + 1}`}
                  >
                    <RotateCcw size={9} aria-hidden="true" /> Retry
                  </button>
                </div>
              )}

              {m.status === "uploaded" && m.driveUrl && (
                <a
                  href={m.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center text-3xl"
                  aria-label={`View ${m.type} ${index + 1} on Drive`}
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
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-900 text-white text-xs py-2.5 rounded-lg"
        >
          <Camera size={14} aria-hidden="true" /> Photo
        </button>
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-700 text-white text-xs py-2.5 rounded-lg"
        >
          <Video size={14} aria-hidden="true" /> Video
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 text-stone-700 text-xs py-2.5 rounded-lg"
        >
          <FolderOpen size={14} aria-hidden="true" /> Gallery
        </button>
      </div>

      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />
      {/* Dedicated retry input — scoped to correct media type via retryTargetRef */}
      <input ref={retryRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={e => { handleRetryFile(e.target.files); e.target.value = "" }} />

      {site.mediaFiles.length === 0 && (
        <p className="text-xs text-stone-400 text-center">No media yet. Take photos or add from your gallery.</p>
      )}
    </div>
  )
}
