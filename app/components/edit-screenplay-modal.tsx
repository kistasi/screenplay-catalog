'use client'

import type { Screenplay } from '@/lib/types'
import { ModalShell } from './modal'
import { PdfUploadForm } from './pdf-upload-form'

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

      <PdfUploadForm
        label={screenplay.pdfName ? 'Replace PDF' : 'Add PDF'}
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving…"
        requirePdf
        onCancel={onClose}
        onSubmit={(pdf) => onSave(pdf!)}
      />
    </ModalShell>
  )
}
