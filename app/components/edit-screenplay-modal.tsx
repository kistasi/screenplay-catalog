'use client'

import { useState } from 'react'
import type { Screenplay } from '@/lib/types'
import { ModalShell } from './modal'

export default function EditScreenplayModal({
  screenplay,
  onClose,
  onSave,
}: {
  screenplay: Screenplay
  onClose: () => void
  // Uploads/replaces the PDF; resolves on success, rejects on failure.
  onSave: (pdf: File) => Promise<void>
}) {
  const [pdf, setPdf] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!pdf) return
    setSaving(true)
    setError(null)
    try {
      await onSave(pdf)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="p-4">
      <h2 className="font-medium">
        {screenplay.title}
        {screenplay.year && (
          <span className="opacity-50"> ({screenplay.year})</span>
        )}
      </h2>
      <p className="mt-0.5 text-sm opacity-60">
        {screenplay.pdfName
          ? `Current PDF: ${screenplay.pdfName}`
          : 'No PDF attached yet.'}
      </p>

      <label className="mt-4 block">
        <span className="text-sm opacity-60">
          {screenplay.pdfName ? 'Replace PDF' : 'Add PDF'}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background hover:file:opacity-90"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !pdf}
          className="cursor-pointer rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
