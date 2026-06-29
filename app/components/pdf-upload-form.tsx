'use client'

import { useState } from 'react'

const FILE_INPUT_CLASS =
  'block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background hover:file:opacity-90'

/**
 * Shared PDF picker: a file input plus an error message and a Cancel/submit
 * button row. Owns the selection, submitting, and error state, so callers only
 * provide labels and an `onSubmit` that persists the file.
 *
 * `requirePdf` disables the submit button until a file is chosen; when false the
 * PDF is optional and `onSubmit` may receive `null`. On success the form is
 * expected to unmount (the caller closes the modal), so it stays in its
 * submitting state rather than resetting.
 */
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

  return (
    <>
      <label className="mt-4 block">
        {label && <span className="text-sm opacity-60">{label}</span>}
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          className={label ? `mt-1 ${FILE_INPUT_CLASS}` : FILE_INPUT_CLASS}
        />
      </label>

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
