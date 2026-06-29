import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddScreenplayButton from './add-screenplay-button'
import type { TmdbMovie } from '@/lib/types'

const matrix: TmdbMovie = {
  id: 603,
  title: 'The Matrix',
  year: '1999',
  overview: 'A hacker discovers reality is a simulation.',
  posterUrl: 'https://img/matrix.jpg',
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}
function errJson(body: unknown, status = 502) {
  return { ok: false, status, json: async () => body } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openModal() {
  await userEvent.click(screen.getByRole('button', { name: '+ Add screenplay' }))
}

describe('AddScreenplayButton', () => {
  it('opens the search modal when clicked', async () => {
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    expect(
      screen.getByPlaceholderText('Search for a film…')
    ).toBeInTheDocument()
  })

  it('does not search for an empty query', async () => {
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    // Give the debounce time to (not) fire.
    await new Promise((r) => setTimeout(r, 350))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('searches the TMDB proxy and lists results', async () => {
    fetchMock.mockResolvedValue(okJson({ results: [matrix] }))
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()

    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'matrix')

    expect(await screen.findByText('The Matrix')).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tmdb/search?query=matrix',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('shows a "No films found" message for an empty result set', async () => {
    fetchMock.mockResolvedValue(okJson({ results: [] }))
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'zzz')
    expect(await screen.findByText('No films found.')).toBeInTheDocument()
  })

  it('shows the error message when the search fails', async () => {
    fetchMock.mockResolvedValue(errJson({ error: 'Upstream failed.' }))
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'matrix')
    expect(await screen.findByText('Upstream failed.')).toBeInTheDocument()
  })

  it('moves to the upload step and confirms with the chosen movie', async () => {
    fetchMock.mockResolvedValue(okJson({ results: [matrix] }))
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<AddScreenplayButton onAdd={onAdd} />)
    await openModal()
    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'matrix')

    await userEvent.click(await screen.findByText('The Matrix'))

    // Upload step: optional PDF, so "Add to catalog" is enabled immediately.
    const confirm = await screen.findByRole('button', { name: 'Add to catalog' })
    await userEvent.click(confirm)

    expect(onAdd).toHaveBeenCalledWith(matrix, null)
  })

  it('closes the modal after a successful add', async () => {
    fetchMock.mockResolvedValue(okJson({ results: [matrix] }))
    render(<AddScreenplayButton onAdd={vi.fn().mockResolvedValue(undefined)} />)
    await openModal()
    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'matrix')
    await userEvent.click(await screen.findByText('The Matrix'))
    await userEvent.click(await screen.findByRole('button', { name: 'Add to catalog' }))

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Search for a film…')
      ).not.toBeInTheDocument()
    )
  })

  it('can go back from the upload step to the search step', async () => {
    fetchMock.mockResolvedValue(okJson({ results: [matrix] }))
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    await userEvent.type(screen.getByPlaceholderText('Search for a film…'), 'matrix')
    await userEvent.click(await screen.findByText('The Matrix'))

    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(screen.getByPlaceholderText('Search for a film…')).toBeInTheDocument()
  })

  it('closes the modal from the Esc button', async () => {
    render(<AddScreenplayButton onAdd={vi.fn()} />)
    await openModal()
    const dialog = screen.getByPlaceholderText('Search for a film…').closest('div')!
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByPlaceholderText('Search for a film…')
    ).not.toBeInTheDocument()
  })
})
