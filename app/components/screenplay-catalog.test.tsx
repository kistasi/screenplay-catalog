import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScreenplayCatalog from './screenplay-catalog'
import type { Screenplay } from '@/lib/types'

const matrix: Screenplay = {
  id: 603,
  title: 'The Matrix',
  year: '1999',
  directors: ['Lana Wachowski'],
  writers: ['Lilly Wachowski'],
  posterUrl: 'https://image.tmdb.org/t/p/w200/matrix.jpg',
  pdfName: 'matrix.pdf',
}
const drive: Screenplay = {
  id: 1,
  title: 'Drive',
  year: '2011',
  directors: ['Nicolas Winding Refn'],
  writers: ['Hossein Amini'],
  posterUrl: null,
  pdfName: null,
}

const fetchMock = vi.fn()

// Resolve the initial GET /api/screenplays with the given catalog.
function loadWith(screenplays: Screenplay[]) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/screenplays' && (!init || init.method === undefined)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ screenplays }),
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({ screenplays }) } as Response)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ScreenplayCatalog', () => {
  it('shows the empty state when the catalog is empty', async () => {
    loadWith([])
    render(<ScreenplayCatalog />)
    expect(
      await screen.findByText(/No screenplays yet/)
    ).toBeInTheDocument()
  })

  it('renders a row per screenplay once loaded', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    expect(await screen.findByText('The Matrix')).toBeInTheDocument()
    expect(screen.getByText('Drive')).toBeInTheDocument()
  })

  it('links to the PDF only for screenplays that have one', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')
    const links = screen.getAllByRole('link', { name: 'View PDF' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/api/screenplays/603/pdf')
  })

  it('filters by title search', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')

    await userEvent.type(screen.getByPlaceholderText('Search title…'), 'matr')

    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })

  it('filters by year via the dropdown', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')

    await userEvent.selectOptions(screen.getByLabelText(/Year/), '2011')

    expect(screen.getByText('Drive')).toBeInTheDocument()
    expect(screen.queryByText('The Matrix')).not.toBeInTheDocument()
  })

  it('filters by clicking a director name', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')

    await userEvent.click(screen.getByRole('button', { name: 'Lana Wachowski' }))

    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })

  it('shows a no-match message and clears filters', async () => {
    loadWith([matrix, drive])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')

    await userEvent.type(screen.getByPlaceholderText('Search title…'), 'nomatch')
    expect(
      screen.getByText('No screenplays match the selected filters.')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.getByText('Drive')).toBeInTheDocument()
  })

  it('deletes a screenplay after confirmation', async () => {
    loadWith([matrix, drive])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ screenplays: [drive] }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ screenplays: [matrix, drive] }),
      } as Response)
    })

    render(<ScreenplayCatalog />)
    const matrixRow = (await screen.findByText('The Matrix')).closest('tr')!
    await userEvent.click(within(matrixRow).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByText('The Matrix')).not.toBeInTheDocument()
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/screenplays/603',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('does not delete when confirmation is declined', async () => {
    loadWith([matrix, drive])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ScreenplayCatalog />)
    const matrixRow = (await screen.findByText('The Matrix')).closest('tr')!
    await userEvent.click(within(matrixRow).getByRole('button', { name: 'Delete' }))

    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')
    ).toBe(false)
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
  })

  it('opens the edit modal for a screenplay', async () => {
    loadWith([matrix])
    render(<ScreenplayCatalog />)
    await screen.findByText('The Matrix')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Current PDF: matrix.pdf')).toBeInTheDocument()
  })

  it('does not render filter controls while loading or when empty', async () => {
    loadWith([])
    render(<ScreenplayCatalog />)
    await screen.findByText(/No screenplays yet/)
    expect(screen.queryByPlaceholderText('Search title…')).not.toBeInTheDocument()
  })
})
