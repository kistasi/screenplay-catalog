'use client'

import type { MovieScreenplay } from '@/lib/types'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { PdfUploadForm } from './pdf-upload-form'

export default function EditScreenplayModal({
  screenplay,
  onClose,
  onSave,
}: {
  screenplay: MovieScreenplay
  onClose: () => void
  // Uploads/replaces the PDF; resolves on success, rejects on failure.
  onSave: (pdf: File) => Promise<void>
}) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {screenplay.title}
        {screenplay.year && (
          <Typography component="span" sx={{ opacity: 0.5 }}>
            {' '}
            ({screenplay.year})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: '0 !important' }}>
        <Typography variant="body2" sx={{ opacity: 0.6 }}>
          {screenplay.pdfName
            ? `Current PDF: ${screenplay.pdfName}`
            : 'No PDF attached yet.'}
        </Typography>

        <PdfUploadForm
          label={screenplay.pdfName ? 'Replace PDF' : 'Add PDF'}
          cancelLabel="Cancel"
          submitLabel="Save"
          submittingLabel="Saving…"
          requirePdf
          onCancel={onClose}
          onSubmit={(pdf) => onSave(pdf!)}
        />
      </DialogContent>
    </Dialog>
  )
}
