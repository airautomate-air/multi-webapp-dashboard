"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, ExternalLink, Download, X, ImageIcon } from "lucide-react"

export default function OcrPage() {
  const { data: session } = useSession()
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    text: string
    docxBase64: string
    driveLink: string
    fileName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    )
    setFiles((prev) => [...prev, ...dropped])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!files.length) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      files.forEach((f) => formData.append("images", f))

      const res = await fetch("/api/ocr", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || data.error || "Failed to process")
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob(
      [Uint8Array.from(atob(result.docxBase64), (c) => c.charCodeAt(0))],
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <span className="text-stone-300">|</span>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-stone-700" />
            <span
              className="text-lg font-semibold text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              OCR Tool
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div className="mb-10">
          <h1
            className="text-4xl font-light text-stone-900 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Extract Text from Images
          </h1>
          <p className="text-stone-500">
            Upload one or more images. We&apos;ll extract all text and save a
            Word document to your Google Drive.
          </p>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload size={28} className="mx-auto mb-3 text-stone-400" />
          <p className="text-stone-600 font-medium mb-1">
            Drop images here or click to upload
          </p>
          <p className="text-sm text-stone-400">PNG, JPG, WEBP supported</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon size={16} className="text-stone-400" />
                  <span className="text-sm text-stone-700">{file.name}</span>
                  <span className="text-xs text-stone-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            ))}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Extracting text...
                </>
              ) : (
                <>
                  <FileText size={15} />
                  Extract & Save to Drive
                </>
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-8 space-y-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <h2
                className="text-xl font-semibold text-stone-900 mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Extracted Text
              </h2>
              <pre className="text-sm text-stone-700 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
                {result.text}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                <Download size={15} />
                Download Word Doc
              </button>
              <a
                href={result.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 border border-stone-200 bg-white text-stone-700 rounded-xl py-3 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <ExternalLink size={15} />
                View in Google Drive
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
