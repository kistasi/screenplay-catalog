import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// The file input has no accessible label text of its own in some variants, so
// grab it directly.
function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
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
})
