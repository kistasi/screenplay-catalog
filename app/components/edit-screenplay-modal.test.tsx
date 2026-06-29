import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditScreenplayModal from './edit-screenplay-modal'
import type { Screenplay } from '@/lib/types'

const base: Screenplay = {
  id: 1,
  title: 'The Matrix',
  year: '1999',
  directors: [],
  writers: [],
  posterUrl: null,
  pdfName: null,
}

function fileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

describe('EditScreenplayModal', () => {
  it('shows the title and year', () => {
    render(
      <EditScreenplayModal screenplay={base} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.getByText('(1999)')).toBeInTheDocument()
  })

  it('prompts to add a PDF when none is attached', () => {
    render(
      <EditScreenplayModal screenplay={base} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.getByText('No PDF attached yet.')).toBeInTheDocument()
    expect(screen.getByText('Add PDF')).toBeInTheDocument()
  })

  it('shows the current PDF name and a Replace label when one exists', () => {
    render(
      <EditScreenplayModal
        screenplay={{ ...base, pdfName: 'final-draft.pdf' }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Current PDF: final-draft.pdf')).toBeInTheDocument()
    expect(screen.getByText('Replace PDF')).toBeInTheDocument()
  })

  it('passes the chosen file to onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <EditScreenplayModal screenplay={base} onClose={vi.fn()} onSave={onSave} />
    )
    const file = new File(['%PDF'], 'script.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput(), file)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(file)
  })

  it('closes when Cancel is clicked', async () => {
    const onClose = vi.fn()
    render(
      <EditScreenplayModal screenplay={base} onClose={onClose} onSave={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
