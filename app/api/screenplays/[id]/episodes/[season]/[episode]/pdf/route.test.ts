import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { findScreenplay } from '@/lib/screenplays-db'
import { readPdf } from '@/lib/uploads'
import type { TvScreenplay } from '@/lib/types'

vi.mock('@/lib/screenplays-db', () => ({ findScreenplay: vi.fn() }))
vi.mock('@/lib/uploads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/uploads')>()
  return { ...actual, readPdf: vi.fn() }
})

const mockFind = vi.mocked(findScreenplay)
const mockReadPdf = vi.mocked(readPdf)

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
      directors: [],
      writers: [],
      pdfName: 'got-s01e01.pdf',
    },
  ],
}

function ctx(id: string, season: string, episode: string) {
  return { params: Promise.resolve({ id, season, episode }) } as Parameters<typeof GET>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/screenplays/[id]/episodes/[season]/[episode]/pdf', () => {
  it('rejects an invalid screenplay key with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('abc', '1', '1'))
    expect(res.status).toBe(400)
    expect(mockReadPdf).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric season or episode with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('tv-1399', 'abc', '1'))
    expect(res.status).toBe(400)
    expect(mockReadPdf).not.toHaveBeenCalled()
  })

  it('404s when no matching episode is attached', async () => {
    mockFind.mockResolvedValue(show)
    mockReadPdf.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), ctx('tv-1399', '2', '1'))
    expect(res.status).toBe(404)
  })

  it('serves the episode PDF', async () => {
    mockFind.mockResolvedValue(show)
    mockReadPdf.mockResolvedValue(Buffer.from('%PDF-1.4'))

    const res = await GET(new Request('http://localhost'), ctx('tv-1399', '1', '1'))

    expect(mockReadPdf).toHaveBeenCalledWith('got-s01e01.pdf')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe('%PDF-1.4')
  })

  it('404s when the screenplay is a movie (no episodes)', async () => {
    mockFind.mockResolvedValue({
      id: 1399,
      mediaType: 'movie',
      title: 'The Matrix',
      year: '1999',
      directors: [],
      writers: [],
      posterUrl: null,
      pdfName: null,
    })
    mockReadPdf.mockResolvedValue(null)

    const res = await GET(new Request('http://localhost'), ctx('movie-1399', '1', '1'))

    expect(res.status).toBe(404)
  })
})
