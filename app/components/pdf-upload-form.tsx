'use client'

import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

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
      <Box sx={{ mt: 2 }}>
        {label && (
          <Typography variant="body2" sx={{ mb: 0.5, opacity: 0.6 }}>
            {label}
          </Typography>
        )}
        <Box
          role="button"
          tabIndex={0}
          aria-label="PDF drop zone"
          data-dragging={dragging || undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 2,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: dragging ? 'text.primary' : 'divider',
            bgcolor: dragging ? 'action.hover' : 'transparent',
            px: 2,
            py: 3,
            textAlign: 'center',
            transition: 'border-color 0.15s, background-color 0.15s',
            '&:hover': { borderColor: 'text.secondary' },
          }}
        >
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            {pdf ? pdf.name : 'Drop a PDF here, or click to browse'}
          </Typography>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) acceptFile(file)
            }}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          />
        </Box>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2.5, justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || (requirePdf && !pdf)}
        >
          {saving ? submittingLabel : submitLabel}
        </Button>
      </Stack>
    </>
  )
}
