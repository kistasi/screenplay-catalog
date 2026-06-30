import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfUploadForm } from './pdf-upload-form'

const baseProps = {
  cancelLabel: 'Cancel',
  submitLabel: 'Save',
  submittingLabel: 'Saving…',
  onCancel: vi.fn(),
}

function pdf(name = 'script.pdf') {
  return new File(['%PDF'], name, { type: 'application/pdf' })
}

function nonPdf(name = 'doc.txt') {
  return new File(['hello'], name, { type: 'text/plain' })
}

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

function dropZone() {
  return screen.getByRole('button', { name: 'PDF drop zone' })
}

function dropFile(file: File) {
  fireEvent.drop(dropZone(), {
    dataTransfer: { files: [file] },
  })
}

describe('PdfUploadForm', () => {
  it('renders an optional label when provided', () => {
    render(
      <PdfUploadForm
        {...baseProps}
        label="Replace PDF"
        requirePdf
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Replace PDF')).toBeInTheDocument()
  })

  it('keeps submit disabled until a file is chosen when requirePdf is true', async () => {
    const { container } = render(
      <PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />
    )
    const submit = screen.getByRole('button', { name: 'Save' })
    expect(submit).toBeDisabled()

    await userEvent.upload(fileInput(container), pdf())
    expect(submit).toBeEnabled()
  })

  it('allows submit with no file when requirePdf is false', () => {
    render(<PdfUploadForm {...baseProps} requirePdf={false} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('submits the selected file', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PdfUploadForm {...baseProps} requirePdf onSubmit={onSubmit} />
    )
    const file = pdf()
    await userEvent.upload(fileInput(container), file)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(file)
  })

  it('submits null when optional and no file chosen', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PdfUploadForm {...baseProps} requirePdf={false} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(null)
  })

  it('shows the submitting label while the submission is in flight', async () => {
    let resolve!: () => void
    const onSubmit = vi.fn(
      () => new Promise<void>((r) => (resolve = r))
    )
    const { container } = render(
      <PdfUploadForm {...baseProps} requirePdf onSubmit={onSubmit} />
    )
    await userEvent.upload(fileInput(container), pdf())
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    resolve()
  })

  it('surfaces the error message and re-enables the form on failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Upload failed.'))
    const { container } = render(
      <PdfUploadForm {...baseProps} requirePdf onSubmit={onSubmit} />
    )
    await userEvent.upload(fileInput(container), pdf())
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Upload failed.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    )
  })

  it('invokes onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <PdfUploadForm
        {...baseProps}
        onCancel={onCancel}
        requirePdf={false}
        onSubmit={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  describe('drag and drop', () => {
    it('shows placeholder text before a file is selected', () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      expect(
        screen.getByText('Drop a PDF here, or click to browse')
      ).toBeInTheDocument()
    })

    it('accepts a dropped PDF and shows its name', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      dropFile(pdf('my-script.pdf'))
      await waitFor(() =>
        expect(screen.getByText('my-script.pdf')).toBeInTheDocument()
      )
    })

    it('enables submit after a PDF is dropped', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      dropFile(pdf())
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      )
    })

    it('submits the dropped file', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={onSubmit} />)
      const file = pdf()
      dropFile(file)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(onSubmit).toHaveBeenCalledWith(file)
    })

    it('shows an error when a non-PDF is dropped', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      dropFile(nonPdf())
      await waitFor(() =>
        expect(
          screen.getByText('Please select a PDF file.')
        ).toBeInTheDocument()
      )
    })

    it('keeps submit disabled when a non-PDF is dropped', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      dropFile(nonPdf())
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      )
    })

    it('applies a dragging style on dragenter and removes it on drop', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      const zone = dropZone()

      fireEvent.dragEnter(zone)
      await waitFor(() => expect(zone.className).toContain('border-foreground'))

      fireEvent.drop(zone, { dataTransfer: { files: [pdf()] } })
      await waitFor(() =>
        expect(zone.className).not.toContain('border-foreground')
      )
    })

    it('clears dragging style on dragleave when counter reaches zero', async () => {
      render(<PdfUploadForm {...baseProps} requirePdf onSubmit={vi.fn()} />)
      const zone = dropZone()

      fireEvent.dragEnter(zone)
      fireEvent.dragEnter(zone)
      fireEvent.dragLeave(zone)
      await waitFor(() => expect(zone.className).toContain('border-foreground'))

      fireEvent.dragLeave(zone)
      await waitFor(() =>
        expect(zone.className).not.toContain('border-foreground')
      )
    })
  })
})
