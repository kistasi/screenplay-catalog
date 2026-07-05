import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TvEpisodeManager } from './tv-episode-manager'
import type { TvScreenplay } from '@/lib/types'

const show: TvScreenplay = {
  id: 1399,
  mediaType: 'tv',
  title: 'Game of Thrones',
  year: '2011',
  posterUrl: null,
  episodes: [
    {
      seasonNumber: 1,
      episodeNumber: 1,
      name: 'Winter Is Coming',
      directors: ['Tim Van Patten'],
      writers: ['David Benioff', 'D. B. Weiss'],
      pdfName: 'got-s01e01.pdf',
    },
  ],
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.spyOn(window, 'confirm')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderManager(screenplay: TvScreenplay = show) {
  const onSaveEpisodePdf = vi.fn().mockResolvedValue(undefined)
  const onRemoveEpisode = vi.fn().mockResolvedValue(undefined)
  const onFilterDirector = vi.fn()
  const onFilterWriter = vi.fn()

  render(
    <TvEpisodeManager
      screenplay={screenplay}
      onSaveEpisodePdf={onSaveEpisodePdf}
      onRemoveEpisode={onRemoveEpisode}
      onFilterDirector={onFilterDirector}
      onFilterWriter={onFilterWriter}
    />
  )

  return { onSaveEpisodePdf, onRemoveEpisode, onFilterDirector, onFilterWriter }
}

describe('TvEpisodeManager', () => {
  it('shows an empty state when no episodes are attached', () => {
    renderManager({ ...show, episodes: [] })
    expect(screen.getByText('No episode PDFs attached yet.')).toBeInTheDocument()
  })

  it('lists each attached episode with its own directors and writers', () => {
    renderManager()
    expect(screen.getByText(/Winter Is Coming/)).toBeInTheDocument()
    expect(screen.getByText('Tim Van Patten')).toBeInTheDocument()
    expect(screen.getByText('David Benioff')).toBeInTheDocument()
    expect(screen.getByText('D. B. Weiss')).toBeInTheDocument()
  })

  it('links "View" to the episode-specific PDF route', () => {
    renderManager()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/api/screenplays/tv-1399/episodes/1/1/pdf'
    )
  })

  it('filters by director/writer when a credited name is clicked', async () => {
    const { onFilterDirector, onFilterWriter } = renderManager()
    await userEvent.click(screen.getByText('Tim Van Patten'))
    expect(onFilterDirector).toHaveBeenCalledWith('Tim Van Patten')
    await userEvent.click(screen.getByText('David Benioff'))
    expect(onFilterWriter).toHaveBeenCalledWith('David Benioff')
  })

  it('removes an episode after confirmation', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    const { onRemoveEpisode } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemoveEpisode).toHaveBeenCalledWith(1, 1)
  })

  it('does not remove an episode when confirmation is declined', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const { onRemoveEpisode } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemoveEpisode).not.toHaveBeenCalled()
  })

  it('replaces an existing episode PDF, reusing its stored directors/writers', async () => {
    const { onSaveEpisodePdf } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))

    expect(screen.getByText(/S1E1 — Winter Is Coming/)).toBeInTheDocument()
    const file = new File(['%PDF'], 'new.pdf', { type: 'application/pdf' })
    await userEvent.upload(document.querySelector('input[type="file"]')!, file)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaveEpisodePdf).toHaveBeenCalledWith(
      1,
      1,
      'Winter Is Coming',
      ['Tim Van Patten'],
      ['David Benioff', 'D. B. Weiss'],
      file
    )
  })

  it('walks the season → episode → upload flow to add a new episode PDF', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/tmdb/tv/1399/seasons') {
        return Promise.resolve(
          okJson({ seasons: [{ seasonNumber: 2, name: 'Season 2', episodeCount: 10 }] })
        )
      }
      if (url === '/api/tmdb/tv/1399/season/2') {
        return Promise.resolve(
          okJson({
            episodes: [
              { episodeNumber: 3, name: 'What Is Dead May Never Die', directors: ['Alan Taylor'], writers: ['Bryan Cogman'] },
            ],
          })
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { onSaveEpisodePdf } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: '+ Add episode PDF' }))

    await screen.findByText('Season 2 (10 episodes)')
    await userEvent.click(screen.getByText('Season 2 (10 episodes)'))

    await screen.findByText(/What Is Dead May Never Die/)
    await userEvent.click(screen.getByText(/What Is Dead May Never Die/))

    expect(screen.getByText(/S2E3 — What Is Dead May Never Die/)).toBeInTheDocument()
    const file = new File(['%PDF'], 'new.pdf', { type: 'application/pdf' })
    await userEvent.upload(document.querySelector('input[type="file"]')!, file)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaveEpisodePdf).toHaveBeenCalledWith(
      2,
      3,
      'What Is Dead May Never Die',
      ['Alan Taylor'],
      ['Bryan Cogman'],
      file
    )
  })

  it('can go back from the season picker without adding an episode', async () => {
    fetchMock.mockResolvedValue(okJson({ seasons: [] }))
    renderManager()
    await userEvent.click(screen.getByRole('button', { name: '+ Add episode PDF' }))
    await waitFor(() => expect(screen.getByText('Pick a season.')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(/Winter Is Coming/)).toBeInTheDocument()
  })

  it('shows an error when the season list fails to load', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: 'Boom.' }) } as Response)
    renderManager()
    await userEvent.click(screen.getByRole('button', { name: '+ Add episode PDF' }))
    expect(await screen.findByText('Boom.')).toBeInTheDocument()
  })
})
