'use client'

import { useRef, useState } from 'react'

export function PdfUploadForm({
  label,
  cancelLabel,
  submitLabel,
  submittingLabel,
  requirePdf,
  onCancel,
  onSubmit,
}: {
  label?: string
  cancelLabel: string
  submitLabel: string
  submittingLabel: string
  requirePdf: boolean
  onCancel: () => void
  onSubmit: (pdf: File | null) => Promise<void>
}) {
  const [pdf, setPdf] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (requirePdf && !pdf) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(pdf)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const acceptFile = (file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setError(null)
      setPdf(file)
    } else {
      setError('Please select a PDF file.')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) acceptFile(file)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (--dragCounter.current === 0) setDragging(false)
  }

  return (
    <>
      <div className="mt-4">
        {label && (
          <span className="mb-1 block text-sm opacity-60">{label}</span>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label="PDF drop zone"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? 'border-foreground bg-white/5'
              : 'border-white/20 hover:border-white/40'
          }`}
        >
          <p className="text-sm opacity-60">
            {pdf ? pdf.name : 'Drop a PDF here, or click to browse'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) acceptFile(file)
            }}
            className="sr-only"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || (requirePdf && !pdf)}
          className="cursor-pointer rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? submittingLabel : submitLabel}
        </button>
      </div>
    </>
  )
}
