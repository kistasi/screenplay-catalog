import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { findScreenplay, upsertEpisode } from '@/lib/screenplays-db'
import { deletePdf, savePdf } from '@/lib/uploads'
import type { TvScreenplay } from '@/lib/types'

vi.mock('@/lib/screenplays-db', () => ({
  findScreenplay: vi.fn(),
  upsertEpisode: vi.fn(),
}))
vi.mock('@/lib/uploads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/uploads')>()
  return { ...actual, savePdf: vi.fn(), deletePdf: vi.fn() }
})

const mockFind = vi.mocked(findScreenplay)
const mockUpsertEpisode = vi.mocked(upsertEpisode)
const mockSavePdf = vi.mocked(savePdf)
const mockDeletePdf = vi.mocked(deletePdf)

const show: TvScreenplay = {
  id: 1399,
  mediaType: 'tv',
  title: 'Game of Thrones',
  year: '2011',
  posterUrl: null,
  episodes: [],
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof POST>[1]
}

function pdfFile(name = 'script.pdf', type = 'application/pdf') {
  return new File(['%PDF'], name, { type })
}

function episodeForm(over: Record<string, string | File> = {}) {
  const form = new FormData()
  form.set('seasonNumber', '1')
  form.set('episodeNumber', '1')
  form.set('name', 'Winter Is Coming')
  form.set('pdf', pdfFile())
  for (const [key, value] of Object.entries(over)) {
    form.set(key, value)
  }
  return form
}

function postRequest(form: FormData) {
  return new Request('http://localhost/api/screenplays/tv-1399/episodes', {
    method: 'POST',
    body: form,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/screenplays/[id]/episodes', () => {
  it('rejects a movie id with 400', async () => {
    const res = await POST(postRequest(episodeForm()), ctx('movie-603'))
    expect(res.status).toBe(400)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('rejects an invalid screenplay key with 400', async () => {
    const res = await POST(postRequest(episodeForm()), ctx('abc'))
    expect(res.status).toBe(400)
  })

  it('rejects a missing seasonNumber/episodeNumber/name', async () => {
    const form = new FormData()
    form.set('pdf', pdfFile())
    const res = await POST(postRequest(form), ctx('tv-1399'))
    expect(res.status).toBe(400)
    expect(mockFind).not.toHaveBeenCalled()
  })

  it('rejects a negative season number', async () => {
    const res = await POST(postRequest(episodeForm({ seasonNumber: '-1' })), ctx('tv-1399'))
    expect(res.status).toBe(400)
  })

  it('rejects an episode number below 1', async () => {
    const res = await POST(postRequest(episodeForm({ episodeNumber: '0' })), ctx('tv-1399'))
    expect(res.status).toBe(400)
  })

  it('rejects a missing PDF', async () => {
    const form = new FormData()
    form.set('seasonNumber', '1')
    form.set('episodeNumber', '1')
    form.set('name', 'Winter Is Coming')
    const res = await POST(postRequest(form), ctx('tv-1399'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'A PDF file is required.' })
  })

  it('rejects a non-PDF upload', async () => {
    const res = await POST(
      postRequest(episodeForm({ pdf: new File(['x'], 'notes.txt', { type: 'text/plain' }) })),
      ctx('tv-1399')
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Uploaded file must be a PDF.' })
  })

  it('404s when the show does not exist', async () => {
    mockFind.mockResolvedValue(undefined)
    const res = await POST(postRequest(episodeForm()), ctx('tv-1399'))
    expect(res.status).toBe(404)
    expect(mockSavePdf).not.toHaveBeenCalled()
  })

  it('saves a new episode PDF under a derived filename', async () => {
    mockFind.mockResolvedValue(show)
    mockUpsertEpisode.mockResolvedValue([
      {
        ...show,
        episodes: [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            name: 'Winter Is Coming',
            directors: ['Tim Van Patten'],
            writers: ['David Benioff'],
            pdfName: 'game-of-thrones-2011-s01e01.pdf',
          },
        ],
      },
    ])

    const res = await POST(
      postRequest(episodeForm({ directors: 'Tim Van Patten', writers: 'David Benioff' })),
      ctx('tv-1399')
    )

    expect(res.status).toBe(200)
    expect(mockSavePdf).toHaveBeenCalledWith(
      'game-of-thrones-2011-s01e01.pdf',
      expect.any(File)
    )
    expect(mockUpsertEpisode).toHaveBeenCalledWith(1399, {
      seasonNumber: 1,
      episodeNumber: 1,
      name: 'Winter Is Coming',
      directors: ['Tim Van Patten'],
      writers: ['David Benioff'],
      pdfName: 'game-of-thrones-2011-s01e01.pdf',
    })
  })

  it('deletes the previous PDF when replacing an existing episode', async () => {
    mockFind.mockResolvedValue({
      ...show,
      episodes: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          name: 'Winter Is Coming',
          directors: [],
          writers: [],
          pdfName: 'old.pdf',
        },
      ],
    })
    mockUpsertEpisode.mockResolvedValue([show])

    await POST(postRequest(episodeForm()), ctx('tv-1399'))

    expect(mockDeletePdf).toHaveBeenCalledWith('old.pdf')
  })

  it('defaults directors/writers to empty arrays when not provided', async () => {
    mockFind.mockResolvedValue(show)
    mockUpsertEpisode.mockResolvedValue([show])

    await POST(postRequest(episodeForm()), ctx('tv-1399'))

    expect(mockUpsertEpisode).toHaveBeenCalledWith(
      1399,
      expect.objectContaining({ directors: [], writers: [] })
    )
  })
})
